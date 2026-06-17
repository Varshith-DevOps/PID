import 'package:flutter/material.dart';
import '../providers/auth_provider.dart';
import 'employee_workspace.dart';
import 'login_screen.dart';

class DashboardShell extends StatefulWidget {
  final AuthProvider authProvider;

  const DashboardShell({super.key, required this.authProvider});

  @override
  State<DashboardShell> createState() => _DashboardShellState();
}

class _DashboardShellState extends State<DashboardShell> {
  int _selectedIndex = 0;

  late final List<Widget> _screens = [
    EmployeeHomeScreen(authProvider: widget.authProvider),
    EmployeeTimeScreen(authProvider: widget.authProvider),
    EmployeeLeaveScreen(authProvider: widget.authProvider),
    EmployeeMoneyScreen(authProvider: widget.authProvider),
    EmployeeMoreScreen(authProvider: widget.authProvider),
  ];

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        title: const Text('Log out?', style: TextStyle(color: Color(0xFFE5E7EB), fontWeight: FontWeight.w800)),
        content: const Text('You will need to login again to access your HRMS workspace.', style: TextStyle(color: Color(0xFF94A3B8))),
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
    return Scaffold(
      backgroundColor: const Color(0xFF0B1020),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1020),
        elevation: 0,
        centerTitle: false,
        titleSpacing: 18,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(0xFF2DD4BF).withOpacity(0.14),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF2DD4BF).withOpacity(0.4)),
              ),
              child: const Icon(Icons.workspaces_outline, color: Color(0xFF2DD4BF), size: 19),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'NexusHR',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Color(0xFFE5E7EB), fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout_rounded, color: Color(0xFF94A3B8)),
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(index: _selectedIndex, children: _screens),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: const Color(0xFF111827),
          indicatorColor: const Color(0xFF2DD4BF).withOpacity(0.16),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return TextStyle(
              color: selected ? const Color(0xFFE5E7EB) : const Color(0xFF94A3B8),
              fontSize: 11,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return IconThemeData(color: selected ? const Color(0xFF2DD4BF) : const Color(0xFF94A3B8), size: 22);
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
