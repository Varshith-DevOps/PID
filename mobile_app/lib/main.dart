import 'package:flutter/material.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_shell.dart';
import 'screens/update_dialog.dart';
import 'services/update_service.dart';
import 'theme/app_theme.dart';
import 'theme/theme_controller.dart';

/// Global theme controller — used by the app shell and Settings theme toggle.
final themeController = ThemeController();

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
      listenable: Listenable.merge([_authProvider, themeController]),
      builder: (context, child) {
        return MaterialApp(
          navigatorKey: _navigatorKey,
          title: 'PID hcms Mobile',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: themeController.mode,
          home: _authProvider.isAuthenticated
              ? DashboardShell(authProvider: _authProvider)
              : LoginScreen(authProvider: _authProvider),
        );
      },
    );
  }
}
