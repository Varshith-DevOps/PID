import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class ApiService {
  // Android emulator uses 10.0.2.2 to reach the host machine.
  // For iOS simulator use http://localhost:5000/api.
  // For a physical device use your PC LAN IP, for example http://192.168.1.10:5000/api.
  static String baseUrl = 'http://10.0.2.2:5000/api';

  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    final companyCode = prefs.getString('companyCode') ?? '';

    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token.isNotEmpty) 'Authorization': 'Bearer $token',
      if (companyCode.isNotEmpty) 'X-Company-Code': companyCode,
    };
  }

  static Future<http.Response> get(String endpoint) async {
    final headers = await _getHeaders();
    final url = Uri.parse('$baseUrl$endpoint');
    return http.get(url, headers: headers);
  }

  static Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    final url = Uri.parse('$baseUrl$endpoint');
    return http.post(url, headers: headers, body: jsonEncode(body));
  }

  static Future<http.Response> put(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    final url = Uri.parse('$baseUrl$endpoint');
    return http.put(url, headers: headers, body: jsonEncode(body));
  }

  static Future<http.Response> patch(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    final url = Uri.parse('$baseUrl$endpoint');
    return http.patch(url, headers: headers, body: jsonEncode(body));
  }

  static Future<dynamic> getJson(String endpoint) async {
    return _decodeResponse(await get(endpoint));
  }

  static Future<dynamic> postJson(String endpoint, Map<String, dynamic> body) async {
    return _decodeResponse(await post(endpoint, body));
  }

  static Future<dynamic> putJson(String endpoint, Map<String, dynamic> body) async {
    return _decodeResponse(await put(endpoint, body));
  }

  static Future<dynamic> patchJson(String endpoint, Map<String, dynamic> body) async {
    return _decodeResponse(await patch(endpoint, body));
  }

  static dynamic _decodeResponse(http.Response response) {
    dynamic body;
    if (response.body.isNotEmpty) {
      try {
        body = jsonDecode(response.body);
      } catch (_) {
        body = response.body;
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final message = body is Map && body['error'] != null
        ? body['error'].toString()
        : _fallbackMessage(response.statusCode);
    throw ApiException(message, response.statusCode);
  }

  static String _fallbackMessage(int statusCode) {
    if (statusCode == 400) return 'Please check the details and try again.';
    if (statusCode == 401) return 'Your session expired. Please login again.';
    if (statusCode == 403) return 'You do not have access to this action.';
    if (statusCode == 404) return 'The requested record was not found.';
    if (statusCode == 409) return 'This action conflicts with an existing record.';
    if (statusCode >= 500) return 'Server is not responding correctly. Try again shortly.';
    return 'Action failed. Please try again.';
  }
}
