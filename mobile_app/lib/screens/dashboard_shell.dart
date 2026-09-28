import 'package:flutter/material.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import 'employee_workspace.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

class DashboardShell extends StatefulWidget {
  final AuthProvider authProvider;

  const DashboardShell({super.key, required this.authProvider});

  @override
  State<DashboardShell> createState() => _DashboardShellState();
}

class _DashboardShellState extends State<DashboardShell> {
  int _selectedIndex = 0;

  // Tabs are built lazily: a screen (and the API calls in its initState) is only
  // created the first time its tab is opened, then cached and kept alive. This
  // avoids firing every tab's network requests at once on login, so the first
  // screen renders much faster.
  final List<Widget?> _builtScreens = List<Widget?>.filled(5, null);

  Widget _screenFor(int index) {
    switch (index) {
      case 0:
        return EmployeeHomeScreen(authProvider: widget.authProvider);
      case 1:
        return EmployeeTimeScreen(authProvider: widget.authProvider);
      case 2:
        return EmployeeLeaveScreen(authProvider: widget.authProvider);
      case 3:
        return EmployeeMoneyScreen(authProvider: widget.authProvider);
      default:
        return EmployeeMoreScreen(authProvider: widget.authProvider);
    }
  }

  Future<void> _handleLogout() async {
    final c = context.colors;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: c.raised,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        title: Text('Log out?', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w800)),
        content: Text('You will need to login again to access your PID hcms workspace.', style: TextStyle(color: c.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Logout')),
        ],
      ),
    );

    if (confirm != true) return;
    await widget.authProvider.logout();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => LoginScreen(authProvider: widget.authProvider)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: c.navInk,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 18,
        title: Row(
          children: [
            Image.asset(
              'assets/brand/pid_hcms_icon.png',
              width: 34,
              height: 34,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'PID hcms',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined, color: Colors.white70),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => SettingsScreen(authProvider: widget.authProvider)),
            ),
          ),
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout_rounded, color: Colors.white70),
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: List<Widget>.generate(5, (i) {
          if (i == _selectedIndex) _builtScreens[i] ??= _screenFor(i);
          return _builtScreens[i] ?? const SizedBox.shrink();
        }),
      ),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: c.raised,
          indicatorColor: c.accent.withValues(alpha: 0.16),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return TextStyle(
              color: selected ? c.textPrimary : c.textSecondary,
              fontSize: 11,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return IconThemeData(color: selected ? c.accent : c.textSecondary, size: 22);
          }),
        ),
        child: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (index) => setState(() => _selectedIndex = index),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Today'),
            NavigationDestination(icon: Icon(Icons.schedule_outlined), selectedIcon: Icon(Icons.schedule_rounded), label: 'Time'),
            NavigationDestination(icon: Icon(Icons.event_available_outlined), selectedIcon: Icon(Icons.event_available), label: 'Leave'),
            NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Money'),
            NavigationDestination(icon: Icon(Icons.apps_outlined), selectedIcon: Icon(Icons.apps_rounded), label: 'More'),
          ],
        ),
      ),
    );
  }
}
