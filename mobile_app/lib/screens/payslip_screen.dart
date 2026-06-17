import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class PayslipScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const PayslipScreen({super.key, required this.authProvider});

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  bool _isLoading = true;
  List<dynamic> _payslips = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchPayslips();
  }

  Future<void> _fetchPayslips() async {
    try {
      final res = await ApiService.get('/payslips/history');
      if (!mounted) return;

      if (res.statusCode == 200) {
        setState(() {
          _payslips = jsonDecode(res.body);
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load salary statements.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'Network connection issue.';
      });
    }
  }

  void _showBreakdownSheet(dynamic payslip) {
    final earnings = payslip['grossEarnings'] ?? 0.0;
    final deductions = payslip['totalDeductions'] ?? 0.0;
    final netPay = payslip['netSalary'] ?? 0.0;

    final basic = payslip['basicSalary'] ?? (earnings * 0.5);
    final hra = payslip['hra'] ?? (earnings * 0.2);
    final special = payslip['specialAllowance'] ?? (earnings * 0.3);
    
    final pf = payslip['pfDeduction'] ?? 1800.0;
    final tax = payslip['tdsDeduction'] ?? 0.0;
    final pt = payslip['professionalTaxDeduction'] ?? 200.0;

    final monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final monthVal = payslip['month'] ?? 1;
    final yearVal = payslip['year'] ?? DateTime.now().year;
    final monthName = monthVal >= 1 && monthVal <= 12 ? monthNames[monthVal] : 'Month';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.8,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 5,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Payslip - $monthName $yearVal',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Itemized earnings and deductions statement',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
                  ),
                  const SizedBox(height: 24),

                  // Net Salary Panel
                  Container(
                    padding: const EdgeInsets.all(20.0),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)]),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        const Text('NET PAYOUT', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                        const SizedBox(height: 6),
                        Text(
                          '₹${NumberFormat('#,##,##0.00').format(netPay)}',
                          style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Earnings Section
                  const Text('Earnings', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _buildStatementRow('Basic Salary', basic),
                  _buildStatementRow('House Rent Allowance (HRA)', hra),
                  _buildStatementRow('Special Allowance', special),
                  _buildStatementRow('Gross Earnings', earnings, isTotal: true),
                  const SizedBox(height: 24),

                  // Deductions Section
                  const Text('Deductions', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _buildStatementRow('Provident Fund (PF)', pf),
                  _buildStatementRow('Professional Tax (PT)', pt),
                  _buildStatementRow('Income Tax (TDS)', tax),
                  _buildStatementRow('Total Deductions', deductions, isTotal: true, isDeduction: true),
                  const SizedBox(height: 32),

                  // Mock PDF Download trigger
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E293B),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFF334155)),
                      ),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Salary receipt exported and saved to downloads directory.'),
                          backgroundColor: Color(0xFF10B981),
                        ),
                      );
                    },
                    icon: const Icon(Icons.download_rounded, color: Colors.white, size: 20),
                    label: const Text('Download PDF Statement', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildStatementRow(String label, dynamic value, {bool isTotal = false, bool isDeduction = false}) {
    final amount = double.tryParse(value.toString()) ?? 0.0;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: const Color(0xFF1E293B).withOpacity(0.5))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isTotal ? Colors.white : const Color(0xFF94A3B8),
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              fontSize: isTotal ? 13.5 : 13,
            ),
          ),
          Text(
            '${isDeduction && amount > 0 ? "-" : ""}₹${NumberFormat('#,##,##0.00').format(amount)}',
            style: TextStyle(
              color: isTotal
                  ? Colors.white
                  : isDeduction
                      ? const Color(0xFFEF4444)
                      : Colors.white70,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w600,
              fontSize: isTotal ? 13.5 : 13,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E1A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Salary Payslips', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF3B82F6)))
          : Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorMessage != null) ...[
                    Text(_errorMessage!, style: const TextStyle(color: Color(0xFFEF4444))),
                    const SizedBox(height: 16),
                  ],
                  Expanded(
                    child: _payslips.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long_rounded, color: const Color(0xFF1E293B), size: 48),
                                const SizedBox(height: 12),
                                const Text(
                                  'No payslip history found for this year.',
                                  style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            itemCount: _payslips.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final payslip = _payslips[index];
                              final monthVal = payslip['month'] ?? 1;
                              final yearVal = payslip['year'] ?? DateTime.now().year;
                              final monthName = monthVal >= 1 && monthVal <= 12 ? monthNames[monthVal] : 'Month';
                              final netPay = payslip['netSalary'] ?? 0.0;

                              return InkWell(
                                onTap: () => _showBreakdownSheet(payslip),
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  padding: const EdgeInsets.all(16.0),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: const Color(0xFF1E293B)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '$monthName $yearVal',
                                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14.5),
                                          ),
                                          const SizedBox(height: 4),
                                          const Text(
                                            'Processed successfully',
                                            style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w500),
                                          ),
                                        ],
                                      ),
                                      Row(
                                        children: [
                                          Text(
                                            '₹${NumberFormat('#,##,##0').format(netPay)}',
                                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                          ),
                                          const SizedBox(width: 12),
                                          const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF475569), size: 14),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }
}
