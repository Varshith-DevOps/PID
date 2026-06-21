import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

/// Outcome of a login or MFA verification attempt.
class AuthResult {
  final bool success;
  final bool mfaRequired;
  final String? error;

  const AuthResult({this.success = false, this.mfaRequired = false, this.error});
}

class AuthProvider extends ChangeNotifier {
  bool _isLoading = false;
  bool _isAuthenticated = false;
  Map<String, dynamic>? _user;
  List<dynamic> _permissions = [];
  String? _companyCode;
  String? _role;

  // Short-lived challenge token returned by /auth/login when MFA is required.
  String? _mfaToken;
  String? get mfaToken => _mfaToken;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  Map<String, dynamic>? get user => _user;
  List<dynamic> get permissions => _permissions;
  String? get companyCode => _companyCode;
  String? get role => _role;
  String? get employeeId => _user?['employeeId']?.toString();
  String get displayName => (_user?['name'] ?? _user?['email'] ?? 'Employee').toString();

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    _companyCode = prefs.getString('companyCode');
    _role = prefs.getString('role');
    final userJson = prefs.getString('user');
    final permissionsJson = prefs.getString('permissions');

    if (token != null && token.isNotEmpty && userJson != null) {
      _user = jsonDecode(userJson);
      _permissions = permissionsJson != null ? jsonDecode(permissionsJson) : [];
      _role = _user?['role']?.toString() ?? _role;
      _isAuthenticated = true;
      notifyListeners();
      refreshProfile();
      return;
    }
    notifyListeners();
  }

  Future<AuthResult> login({
    required String companyCode,
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _mfaToken = null;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('companyCode', companyCode.trim());
      _companyCode = companyCode.trim();

      final response = await ApiService.post('/auth/login', {
        'email': email.trim(),
        'password': password,
      });

      final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

      if (response.statusCode == 200) {
        if (data['mfaRequired'] == true) {
          _mfaToken = data['mfaToken']?.toString();
          _isLoading = false;
          notifyListeners();
          if (_mfaToken == null) {
            return const AuthResult(error: 'MFA is required but the server did not return a challenge token.');
          }
          return const AuthResult(mfaRequired: true);
        }

        return await _persistSession(data);
      }

      _isLoading = false;
      notifyListeners();
      return AuthResult(
        error: data is Map && data['error'] != null
            ? data['error'].toString()
            : 'Login failed. Check company code, email, and password.',
      );
    } catch (_) {
      _isLoading = false;
      notifyListeners();
      return const AuthResult(error: 'Cannot reach PID hcms API. Check server URL and network connection.');
    }
  }

  /// Completes a login that required MFA by submitting either a 6-digit
  /// authenticator code or a recovery code to /auth/mfa/verify-login.
  Future<AuthResult> verifyMfa({String? code, String? recoveryCode}) async {
    final challenge = _mfaToken;
    if (challenge == null) {
      return const AuthResult(error: 'MFA session expired. Please login again.');
    }
    _isLoading = true;
    notifyListeners();
    try {
      final response = await ApiService.post('/auth/mfa/verify-login', {
        'mfaToken': challenge,
        if (code != null && code.isNotEmpty) 'code': code.trim(),
        if (recoveryCode != null && recoveryCode.isNotEmpty) 'recoveryCode': recoveryCode.trim(),
      });
      final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
      if (response.statusCode == 200) {
        _mfaToken = null;
        return await _persistSession(data);
      }
      _isLoading = false;
      notifyListeners();
      return AuthResult(
        error: data is Map && data['error'] != null ? data['error'].toString() : 'Invalid verification code.',
      );
    } catch (_) {
      _isLoading = false;
      notifyListeners();
      return const AuthResult(error: 'Cannot reach PID hcms API. Check your network connection.');
    }
  }

  /// Persists a successful auth payload (from login or MFA) into local storage
  /// and flips the provider into the authenticated state.
  Future<AuthResult> _persistSession(dynamic data) async {
    final token = data is Map ? data['token'] : null;
    final userData = Map<String, dynamic>.from((data is Map ? data['user'] : null) ?? {});
    final userRole = userData['role'] ?? 'EMPLOYEE';
    final permissions = List<dynamic>.from((data is Map ? data['permissions'] : null) ?? []);

    if (token == null || token.toString().isEmpty) {
      _isLoading = false;
      notifyListeners();
      return const AuthResult(error: 'Login succeeded but no session token was returned.');
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('role', userRole);
    await prefs.setString('user', jsonEncode(userData));
    await prefs.setString('permissions', jsonEncode(permissions));

    _user = userData;
    _permissions = permissions;
    _role = userRole;
    _isAuthenticated = true;
    _isLoading = false;
    notifyListeners();
    return const AuthResult(success: true);
  }

  Future<void> refreshProfile() async {
    if (!_isAuthenticated) return;
    try {
      final data = await ApiService.getJson('/auth/profile');
      if (data is Map) {
        final userData = Map<String, dynamic>.from(data['user'] ?? {});
        final permissions = List<dynamic>.from(data['permissions'] ?? []);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(userData));
        await prefs.setString('permissions', jsonEncode(permissions));
        await prefs.setString('role', userData['role']?.toString() ?? _role ?? 'EMPLOYEE');

        _user = userData;
        _permissions = permissions;
        _role = userData['role']?.toString() ?? _role;
        notifyListeners();
      }
    } catch (_) {
      // Keep the saved session. The next API call will show a clear action error if the token is invalid.
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('role');
    await prefs.remove('user');
    await prefs.remove('permissions');

    _user = null;
    _permissions = [];
    _role = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
