import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/ui.dart';

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
        final c = context.colors;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approve ? 'Leave request approved.' : 'Leave request rejected.'),
            backgroundColor: approve ? c.success : c.danger,
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
        final c = context.colors;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approve ? 'Expense claim approved.' : 'Expense claim rejected.'),
            backgroundColor: approve ? c.success : c.danger,
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
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: Column(
        children: [
          TabBar(
            controller: _tabController,
            dividerColor: c.border,
            indicatorColor: c.accent,
            labelColor: c.textPrimary,
            unselectedLabelColor: c.textMuted,
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
                style: TextStyle(color: c.danger, fontSize: 13),
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Leaves List View
                _loadingLeaves ? const LoadingView() : _buildLeavesList(),

                // Expenses List View
                _loadingExpenses ? const LoadingView() : _buildExpensesList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeavesList() {
    if (_leaveRequests.isEmpty) {
      return const EmptyView(
        icon: Icons.done_all_rounded,
        message: 'No pending leave approvals.',
      );
    }

    final c = context.colors;
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

        return AppCard(
          padding: const EdgeInsets.all(18.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      empName,
                      style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusChip(label: type.toString(), tone: ChipTone.leave),
                ],
              ),
              const SizedBox(height: 6),
              Text('$startStr - $endStr', style: TextStyle(color: c.textSecondary, fontSize: 12.5)),
              const SizedBox(height: 10),
              Text(
                reason,
                style: TextStyle(color: c.textMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => _handleLeaveAction(id, false),
                    style: TextButton.styleFrom(foregroundColor: c.danger),
                    child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  PrimaryButton(
                    label: 'Approve',
                    onPressed: () => _handleLeaveAction(id, true),
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
      return const EmptyView(
        icon: Icons.done_all_rounded,
        message: 'No pending expense approvals.',
      );
    }

    final c = context.colors;
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

        return AppCard(
          padding: const EdgeInsets.all(18.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      empName,
                      style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  Text(
                    '₹${NumberFormat('#,##,##0').format(amount)}',
                    style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  StatusChip(label: category.toString().toUpperCase(), tone: ChipTone.payroll),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                desc,
                style: TextStyle(color: c.textMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => _handleExpenseAction(id, false),
                    style: TextButton.styleFrom(foregroundColor: c.danger),
                    child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  PrimaryButton(
                    label: 'Approve',
                    onPressed: () => _handleExpenseAction(id, true),
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
