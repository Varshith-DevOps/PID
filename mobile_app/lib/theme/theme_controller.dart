import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Holds the active [ThemeMode] and persists the user's choice.
/// Light is the default; users can opt into dark (or follow the system).
class ThemeController extends ChangeNotifier {
  static const _key = 'pid_theme_mode';
  ThemeMode _mode = ThemeMode.light;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  ThemeController() {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final v = prefs.getString(_key);
      if (v == 'dark') {
        _mode = ThemeMode.dark;
      } else if (v == 'light') {
        _mode = ThemeMode.light;
      } else if (v == 'system') {
        _mode = ThemeMode.system;
      }
      notifyListeners();
    } catch (_) {
      // SharedPreferences unavailable — keep the default.
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    _mode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, mode.name);
    } catch (_) {
      // ignore persistence failure
    }
  }

  Future<void> toggle() => setMode(isDark ? ThemeMode.light : ThemeMode.dark);
}
