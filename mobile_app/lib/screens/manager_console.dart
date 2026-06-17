import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class ManagerConsole extends StatefulWidget {
  final AuthProvider authProvider;

  const ManagerConsole({super.key, required this.authProvider});

  @override
  State<ManagerConsole> createState() => _ManagerConsoleState();
}

class _ManagerConsoleState extends State<ManagerConsole> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loadingLeaves = true;
  bool _loadingExpenses = true;
  List<dynamic> _leaveRequests = [];
  List<dynamic> _expenseClaims = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchLeaves();
    _fetchExpenses();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchLeaves() async {
    try {
      final res = await ApiService.get('/leave');
      if (!mounted) return;

      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        setState(() {
          // Filter only pending requests
          _leaveRequests = data.where((item) => item['status'] == 'PENDING').toList();
          _loadingLeaves = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingLeaves = false);
    }
  }

  Future<void> _fetchExpenses() async {
    try {
      final res = await ApiService.get('/expenses/claims');
      if (!mounted) return;

      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        setState(() {
          // Filter only claims that require manager approval
          _expenseClaims = data.where((item) => item['managerApproval'] == 'PENDING').toList();
          _loadingExpenses = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingExpenses = false);
    }
  }

  Future<void> _handleLeaveAction(String id, bool approve) async {
    final actionStr = approve ? 'approve' : 'reject';
    setState(() => _loadingLeaves = true);

    try {
      final res = await ApiService.put('/leave/$id/$actionStr', {});
      if (!mounted) return;

      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approve ? 'Leave request approved.' : 'Leave request rejected.'),
            backgroundColor: approve ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          ),
        );
        _fetchLeaves();
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _errorMessage = data['error'] ?? 'Approval action failed.';
          _loadingLeaves = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network connection issue.';
        _loadingLeaves = false;
      });
    }
  }

  Future<void> _handleExpenseAction(String id, bool approve) async {
    final endpoint = approve ? '/expenses/claims/$id/manager-approve' : '/expenses/claims/$id/reject';
    setState(() => _loadingExpenses = true);

    try {
      final res = await ApiService.put(endpoint, {});
      if (!mounted) return;

      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approve ? 'Expense claim approved.' : 'Expense claim rejected.'),
            backgroundColor: approve ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          ),
        );
        _fetchExpenses();
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _errorMessage = data['error'] ?? 'Approval action failed.';
          _loadingExpenses = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network connection issue.';
        _loadingExpenses = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: Column(
        children: [
          TabBar(
            controller: _tabController,
            dividerColor: const Color(0xFF1E293B),
            indicatorColor: const Color(0xFF3B82F6),
            labelColor: Colors.white,
            unselectedLabelColor: const Color(0xFF64748B),
            tabs: const [
              Tab(text: 'Leave Requests'),
              Tab(text: 'Expense Claims'),
            ],
          ),
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.only(left: 24.0, right: 24.0, top: 16.0),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Leaves List View
                _loadingLeaves
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF3B82F6)))
                    : _buildLeavesList(),

                // Expenses List View
                _loadingExpenses
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
                    : _buildExpensesList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeavesList() {
    if (_leaveRequests.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.done_all_rounded, color: const Color(0xFF1E293B), size: 48),
            const SizedBox(height: 12),
            const Text(
              'No pending leave approvals.',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(24.0),
      itemCount: _leaveRequests.length,
      separatorBuilder: (context, index) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final req = _leaveRequests[index];
        final empName = req['employee'] != null
            ? '${req['employee']['firstName'] ?? ""} ${req['employee']['lastName'] ?? ""}'
            : 'Employee';
        final type = req['type'] ?? 'LEAVE';
        final startStr = req['startDate'] != null
            ? DateFormat('dd MMM').format(DateTime.parse(req['startDate']))
            : '-';
        final endStr = req['endDate'] != null
            ? DateFormat('dd MMM yyyy').format(DateTime.parse(req['endDate']))
            : '-';
        final reason = req['reason'] ?? 'No reason provided';
        final id = req['id'].toString();

        return Container(
          padding: const EdgeInsets.all(18.0),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    empName,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      type.toString().replaceAll('_', ' '),
                      style: const TextStyle(color: Color(0xFF60A5FA), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text('$startStr - $endStr', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5)),
              const SizedBox(height: 10),
              Text(
                reason,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => _handleLeaveAction(id, false),
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFFEF4444)),
                    child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: () => _handleLeaveAction(id, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Approve', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildExpensesList() {
    if (_expenseClaims.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.done_all_rounded, color: const Color(0xFF1E293B), size: 48),
            const SizedBox(height: 12),
            const Text(
              'No pending expense approvals.',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(24.0),
      itemCount: _expenseClaims.length,
      separatorBuilder: (context, index) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final claim = _expenseClaims[index];
        final empName = claim['employee'] != null
            ? '${claim['employee']['firstName'] ?? ""} ${claim['employee']['lastName'] ?? ""}'
            : 'Employee';
        final category = claim['category'] ?? 'General';
        final amount = claim['amount'] ?? 0.0;
        final desc = claim['description'] ?? '';
        final id = claim['id'].toString();

        return Container(
          padding: const EdgeInsets.all(18.0),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    empName,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  Text(
                    '₹${NumberFormat('#,##,##0').format(amount)}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      category.toString().toUpperCase(),
                      style: const TextStyle(color: Color(0xFF34D399), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                desc,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => _handleExpenseAction(id, false),
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFFEF4444)),
                    child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: () => _handleExpenseAction(id, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Approve', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
