import 'package:flutter/material.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_shell.dart';
import 'screens/update_dialog.dart';
import 'services/update_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PIDHcmsApp());
}

class PIDHcmsApp extends StatefulWidget {
  const PIDHcmsApp({super.key});

  @override
  State<PIDHcmsApp> createState() => _PIDHcmsAppState();
}

class _PIDHcmsAppState extends State<PIDHcmsApp> {
  late AuthProvider _authProvider;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool _updatePrompted = false;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForUpdate());
  }

  /// Silent launch-time OTA check. Shows the update dialog when a newer build is
  /// available; mandatory updates block the app. Fails quietly when offline.
  Future<void> _checkForUpdate() async {
    if (_updatePrompted) return;
    final info = await UpdateService.check();
    if (info == null || !info.updateAvailable) return;
    final context = _navigatorKey.currentContext;
    if (context == null || !mounted) return;
    _updatePrompted = true;
    await showUpdateDialog(context, info);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _authProvider,
      builder: (context, child) {
        return MaterialApp(
          navigatorKey: _navigatorKey,
          title: 'PID hcms Mobile',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.dark,
            primaryColor: const Color(0xFF00A7B5),
            scaffoldBackgroundColor: const Color(0xFF07111F),
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF00A7B5),
              secondary: Color(0xFFFFB23F),
              surface: Color(0xFF111827),
              error: Color(0xFFFB7185),
            ),
            fontFamily: 'Roboto',
            textTheme: const TextTheme(
              bodyLarge: TextStyle(color: Color(0xFFE5E7EB)),
              bodyMedium: TextStyle(color: Color(0xFF94A3B8)),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFF172033),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF263247)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF00A7B5)),
              ),
            ),
            snackBarTheme: const SnackBarThemeData(
              behavior: SnackBarBehavior.floating,
              backgroundColor: Color(0xFF111827),
              contentTextStyle: TextStyle(color: Color(0xFFE5E7EB)),
            ),
          ),
          home: _authProvider.isAuthenticated
              ? DashboardShell(authProvider: _authProvider)
              : LoginScreen(authProvider: _authProvider),
        );
      },
    );
  }
}
