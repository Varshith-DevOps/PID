import 'dart:convert';
import 'package:flutter/material.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'payslip_screen.dart';
import 'expense_screen.dart';

class HomeScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const HomeScreen({super.key, required this.authProvider});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  int _earnedLeaves = 0;
  int _casualLeaves = 0;
  int _sickLeaves = 0;
  String _shiftName = 'Standard Shift';
  String _shiftTimings = '09:00 AM - 06:00 PM';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    try {
      final leaveRes = await ApiService.get('/leave/balances');
      final shiftRes = await ApiService.get('/shifts/schedule');

      if (!mounted) return;

      int el = 15;
      int cl = 7;
      int sl = 7;

      if (leaveRes.statusCode == 200) {
        final leaveData = jsonDecode(leaveRes.body);
        if (leaveData is Map) {
          el = leaveData['earnedBalance'] ?? 15;
          cl = leaveData['casualBalance'] ?? 7;
          sl = leaveData['sickBalance'] ?? 7;
        }
      }

      String sName = 'Standard Day Shift';
      String sTimings = '09:00 AM - 06:00 PM';
      if (shiftRes.statusCode == 200) {
        final shiftData = jsonDecode(shiftRes.body);
        if (shiftData is Map && shiftData.containsKey('shift')) {
          final sh = shiftData['shift'];
          sName = sh['name'] ?? sName;
          sTimings = '${sh['startTime'] ?? "09:00"} - ${sh['endTime'] ?? "18:00"}';
        }
      }

      setState(() {
        _earnedLeaves = el;
        _casualLeaves = cl;
        _sickLeaves = sl;
        _shiftName = sName;
        _shiftTimings = sTimings;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load details. Showing cached data.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authProvider.user;
    final firstName = user?['firstName'] ?? 'Employee';
    final lastName = user?['lastName'] ?? '';
    final role = widget.authProvider.role ?? 'EMPLOYEE';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: RefreshIndicator(
        onRefresh: _fetchDashboardData,
        color: const Color(0xFF3B82F6),
        backgroundColor: const Color(0xFF0F172A),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Section
              Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: const Color(0xFF1E293B),
                    child: Text(
                      firstName[0].toUpperCase(),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF3B82F6),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome back,',
                          style: TextStyle(
                            fontSize: 14,
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          '$firstName $lastName',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.2)),
                    ),
                    child: Text(
                      role,
                      style: const TextStyle(
                        color: Color(0xFF60A5FA),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
                const SizedBox(height: 16),
              ],

              // Shift Roster Schedule Card
              const Text(
                'Today\'s Schedule',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(18.0),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF1E293B)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.schedule_rounded, color: Color(0xFFA78BFA), size: 24),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _shiftName,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _shiftTimings,
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Leaves Balance Summary
              const Text(
                'Accrued Leave Balances',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildLeaveCircle(title: 'Earned (EL)', count: _earnedLeaves, color: const Color(0xFF3B82F6), max: 30),
                  _buildLeaveCircle(title: 'Casual (CL)', count: _casualLeaves, color: const Color(0xFF10B981), max: 12),
                  _buildLeaveCircle(title: 'Sick (SL)', count: _sickLeaves, color: const Color(0xFFF59E0B), max: 12),
                ],
              ),
              const SizedBox(height: 36),

              // Quick Actions Grid
              const Text(
                'Quick Self-Service Actions',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                childAspectRatio: 1.45,
                children: [
                  _buildQuickActionCard(
                    icon: Icons.receipt_long_rounded,
                    title: 'Payslips',
                    subtitle: 'View statements',
                    color: const Color(0xFF3B82F6),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => PayslipScreen(authProvider: widget.authProvider)),
                      );
                    },
                  ),
                  _buildQuickActionCard(
                    icon: Icons.payments_outlined,
                    title: 'Claims',
                    subtitle: 'Expense reimbursements',
                    color: const Color(0xFF10B981),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => ExpenseScreen(authProvider: widget.authProvider)),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLeaveCircle({
    required String title,
    required int count,
    required Color color,
    required int max,
  }) {
    final double percent = (count / max).clamp(0.0, 1.0);

    return Container(
      width: 104,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 50,
                height: 50,
                child: CircularProgressIndicator(
                  value: percent,
                  strokeWidth: 4.5,
                  backgroundColor: const Color(0xFF1E293B),
                  color: color,
                ),
              ),
              Text(
                '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18.0),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF1E293B)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14.5),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
