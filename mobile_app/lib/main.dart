import 'package:flutter/material.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NexusHRApp());
}

class NexusHRApp extends StatefulWidget {
  const NexusHRApp({super.key});

  @override
  State<NexusHRApp> createState() => _NexusHRAppState();
}

class _NexusHRAppState extends State<NexusHRApp> {
  late AuthProvider _authProvider;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _authProvider,
      builder: (context, child) {
        return MaterialApp(
          title: 'NexusHR Mobile',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.dark,
            primaryColor: const Color(0xFF2DD4BF),
            scaffoldBackgroundColor: const Color(0xFF0B1020),
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF2DD4BF),
              secondary: Color(0xFFF59E0B),
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
                borderSide: const BorderSide(color: Color(0xFF2DD4BF)),
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
