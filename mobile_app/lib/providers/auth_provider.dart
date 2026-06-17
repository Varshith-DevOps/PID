import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoading = false;
  bool _isAuthenticated = false;
  Map<String, dynamic>? _user;
  List<dynamic> _permissions = [];
  String? _companyCode;
  String? _role;

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

  Future<String?> login({
    required String companyCode,
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('companyCode', companyCode.trim());

      final response = await ApiService.post('/auth/login', {
        'email': email.trim(),
        'password': password,
      });

      final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

      if (response.statusCode == 200) {
        if (data['mfaRequired'] == true) {
          _isLoading = false;
          notifyListeners();
          return 'MFA is enabled for this account. Please complete MFA login from the web app for now.';
        }

        final token = data['token'];
        final userData = Map<String, dynamic>.from(data['user'] ?? {});
        final userRole = userData['role'] ?? 'EMPLOYEE';
        final permissions = List<dynamic>.from(data['permissions'] ?? []);

        if (token == null || token.toString().isEmpty) {
          _isLoading = false;
          notifyListeners();
          return 'Login succeeded but no session token was returned.';
        }

        await prefs.setString('token', token);
        await prefs.setString('role', userRole);
        await prefs.setString('user', jsonEncode(userData));
        await prefs.setString('permissions', jsonEncode(permissions));

        _user = userData;
        _permissions = permissions;
        _companyCode = companyCode.trim();
        _role = userRole;
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        return null;
      }

      _isLoading = false;
      notifyListeners();
      return data is Map && data['error'] != null
          ? data['error'].toString()
          : 'Login failed. Check company code, email, and password.';
    } catch (_) {
      _isLoading = false;
      notifyListeners();
      return 'Cannot reach NexusHR API. Check server URL and network connection.';
    }
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
