import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class LeaveScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const LeaveScreen({super.key, required this.authProvider});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  bool _isLoading = true;
  List<dynamic> _requests = [];
  int _earnedLeaves = 0;
  int _casualLeaves = 0;
  int _sickLeaves = 0;

  @override
  void initState() {
    super.initState();
    _fetchLeaveData();
  }

  Future<void> _fetchLeaveData() async {
    try {
      final balanceRes = await ApiService.get('/leave/balances');
      final requestsRes = await ApiService.get('/leave/requests');

      if (!mounted) return;

      int el = 15, cl = 7, sl = 7;
      if (balanceRes.statusCode == 200) {
        final bal = jsonDecode(balanceRes.body);
        if (bal is Map) {
          el = bal['earnedBalance'] ?? 15;
          cl = bal['casualBalance'] ?? 7;
          sl = bal['sickBalance'] ?? 7;
        }
      }

      List<dynamic> reqs = [];
      if (requestsRes.statusCode == 200) {
        reqs = jsonDecode(requestsRes.body);
      }

      setState(() {
        _earnedLeaves = el;
        _casualLeaves = cl;
        _sickLeaves = sl;
        _requests = reqs;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showAddRequestSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return _LeaveRequestBottomSheet(
          onSuccess: () {
            Navigator.pop(context);
            setState(() => _isLoading = true);
            _fetchLeaveData();
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: const Color(0xFF0A0E1A),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF3B82F6))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quick Mini Balances Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildMiniBalance(title: 'Earned', count: _earnedLeaves, color: const Color(0xFF3B82F6)),
                _buildMiniBalance(title: 'Casual', count: _casualLeaves, color: const Color(0xFF10B981)),
                _buildMiniBalance(title: 'Sick', count: _sickLeaves, color: const Color(0xFFF59E0B)),
              ],
            ),
            const SizedBox(height: 32),

            const Text(
              'Leave Request History',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            Expanded(
              child: _requests.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.calendar_today_rounded, color: const Color(0xFF1E293B), size: 48),
                          const SizedBox(height: 12),
                          const Text(
                            'No leave applications filed yet.',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      itemCount: _requests.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final req = _requests[index];
                        final type = req['type'] ?? 'LEAVE';
                        final startStr = req['startDate'] != null
                            ? DateFormat('dd MMM').format(DateTime.parse(req['startDate']))
                            : '-';
                        final endStr = req['endDate'] != null
                            ? DateFormat('dd MMM yyyy').format(DateTime.parse(req['endDate']))
                            : '-';
                        final reason = req['reason'] ?? 'No reason provided';
                        final status = req['status'] ?? 'PENDING';

                        Color statusColor = const Color(0xFFF59E0B);
                        if (status == 'APPROVED') statusColor = const Color(0xFF10B981);
                        if (status == 'REJECTED') statusColor = const Color(0xFFEF4444);

                        return Container(
                          padding: const EdgeInsets.all(16.0),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFF1E293B)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    type.toString().replaceAll('_', ' '),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14.5,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: statusColor.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(color: statusColor.withOpacity(0.2)),
                                    ),
                                    child: Text(
                                      status,
                                      style: TextStyle(
                                        color: statusColor,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '$startStr - $endStr',
                                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                reason,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddRequestSheet,
        backgroundColor: const Color(0xFF3B82F6),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }

  Widget _buildMiniBalance({required String title, required int count, required Color color}) {
    return Container(
      width: 100,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _LeaveRequestBottomSheet extends StatefulWidget {
  final VoidCallback onSuccess;

  const _LeaveRequestBottomSheet({required this.onSuccess});

  @override
  State<_LeaveRequestBottomSheet> createState() => _LeaveRequestBottomSheetState();
}

class _LeaveRequestBottomSheetState extends State<_LeaveRequestBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  String _leaveType = 'CASUAL';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 1));
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3B82F6),
              surface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(_startDate)) {
            _endDate = _startDate.add(const Duration(days: 1));
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) return;
    if (_endDate.isBefore(_startDate)) {
      setState(() => _errorMessage = 'End date cannot be before start date.');
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.post('/leave/request', {
        'type': _leaveType,
        'startDate': _startDate.toIso8601String(),
        'endDate': _endDate.toIso8601String(),
        'reason': _reasonController.text.trim(),
      });

      if (!mounted) return;

      if (res.statusCode == 200 || res.statusCode == 201) {
        widget.onSuccess();
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _errorMessage = data['error'] ?? 'Failed to file leave request.';
        });
      }
    } catch (e) {
      setState(() => _errorMessage = 'Network error occurred.');
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        left: 24,
        right: 24,
        top: 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Apply for Leave',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            if (_errorMessage != null) ...[
              Text(
                _errorMessage!,
                style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
              ),
              const SizedBox(height: 12),
            ],

            // Leave Type Dropdown
            const Text('Leave Type', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _leaveType,
              dropdownColor: const Color(0xFF0F172A),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B).withOpacity(0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
              items: const [
                DropdownMenuItem(value: 'CASUAL', child: Text('Casual Leave')),
                DropdownMenuItem(value: 'SICK', child: Text('Sick Leave')),
                DropdownMenuItem(value: 'EARNED', child: Text('Earned Leave')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _leaveType = val);
              },
            ),
            const SizedBox(height: 16),

            // Date Pickers Row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Start Date', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () => _pickDate(true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B).withOpacity(0.4),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            DateFormat('dd MMM yyyy').format(_startDate),
                            style: const TextStyle(color: Colors.white, fontSize: 13.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('End Date', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () => _pickDate(false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B).withOpacity(0.4),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            DateFormat('dd MMM yyyy').format(_endDate),
                            style: const TextStyle(color: Colors.white, fontSize: 13.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Reason Text Area
            const Text('Reason / Remarks', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _reasonController,
              maxLines: 3,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Reason is required';
                return null;
              },
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B).withOpacity(0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                hintText: 'Describe details for leave approval...',
                hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B82F6),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _submitting ? null : _submitRequest,
              child: _submitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Application', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
