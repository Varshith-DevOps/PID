import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class ExpenseScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const ExpenseScreen({super.key, required this.authProvider});

  @override
  State<ExpenseScreen> createState() => _ExpenseScreenState();
}

class _ExpenseScreenState extends State<ExpenseScreen> {
  bool _isLoading = true;
  List<dynamic> _claims = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchClaims();
  }

  Future<void> _fetchClaims() async {
    try {
      final res = await ApiService.get('/expenses/claims');
      if (!mounted) return;

      if (res.statusCode == 200) {
        setState(() {
          _claims = jsonDecode(res.body);
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load expense history.';
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

  void _showAddClaimSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return _ExpenseClaimBottomSheet(
          onSuccess: () {
            Navigator.pop(context);
            setState(() => _isLoading = true);
            _fetchClaims();
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
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E1A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Expense Claims', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_errorMessage != null) ...[
              Text(_errorMessage!, style: const TextStyle(color: Color(0xFFEF4444))),
              const SizedBox(height: 16),
            ],
            Expanded(
              child: _claims.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.receipt_long_rounded, color: const Color(0xFF1E293B), size: 48),
                          const SizedBox(height: 12),
                          const Text(
                            'No claim reports filed yet.',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      itemCount: _claims.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final claim = _claims[index];
                        final category = claim['category'] ?? 'General';
                        final amount = claim['amount'] ?? 0.0;
                        final desc = claim['description'] ?? '';
                        final mStatus = claim['managerApproval'] ?? 'PENDING';
                        final fStatus = claim['financeApproval'] ?? 'PENDING';

                        Color mColor = const Color(0xFFF59E0B);
                        if (mStatus == 'APPROVED') mColor = const Color(0xFF10B981);
                        if (mStatus == 'REJECTED') mColor = const Color(0xFFEF4444);

                        Color fColor = const Color(0xFFF59E0B);
                        if (fStatus == 'APPROVED') fColor = const Color(0xFF10B981);
                        if (fStatus == 'REJECTED') fColor = const Color(0xFFEF4444);

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
                                    category.toString().toUpperCase(),
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13.5),
                                  ),
                                  Text(
                                    '₹${NumberFormat('#,##,##0.00').format(amount)}',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14.5),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(desc, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5)),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  _buildStatusBadge('Manager', mStatus, mColor),
                                  const SizedBox(width: 8),
                                  _buildStatusBadge('Finance', fStatus, fColor),
                                ],
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
        onPressed: _showAddClaimSheet,
        backgroundColor: const Color(0xFF10B981),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }

  Widget _buildStatusBadge(String label, String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Text(
        '$label: $status',
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _ExpenseClaimBottomSheet extends StatefulWidget {
  final VoidCallback onSuccess;

  const _ExpenseClaimBottomSheet({required this.onSuccess});

  @override
  State<_ExpenseClaimBottomSheet> createState() => _ExpenseClaimBottomSheetState();
}

class _ExpenseClaimBottomSheetState extends State<_ExpenseClaimBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descController = TextEditingController();
  String _category = 'TRAVEL';
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _amountController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _submitClaim() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token') ?? '';
      final companyCode = prefs.getString('companyCode') ?? '';

      // Create multipart request to match the Multer router file upload expectation
      final uri = Uri.parse('${ApiService.baseUrl}/expenses/claims');
      final request = http.MultipartRequest('POST', uri);

      if (token.isNotEmpty) request.headers['Authorization'] = 'Bearer $token';
      if (companyCode.isNotEmpty) request.headers['X-Company-Code'] = companyCode;

      request.fields['amount'] = _amountController.text.trim();
      request.fields['category'] = _category;
      request.fields['description'] = _descController.text.trim();

      final streamedRes = await request.send();
      final res = await http.Response.fromStream(streamedRes);

      if (!mounted) return;

      if (res.statusCode == 200 || res.statusCode == 201) {
        widget.onSuccess();
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _errorMessage = data['error'] ?? 'Claim rejected. Check guidelines.';
        });
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to upload claim. Please check network.');
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
              'Submit Expense Claim',
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

            // Category Selector
            const Text('Expense Category', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _category,
              dropdownColor: const Color(0xFF0F172A),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B).withOpacity(0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
              items: const [
                DropdownMenuItem(value: 'TRAVEL', child: Text('Travel & Lodging')),
                DropdownMenuItem(value: 'FOOD', child: Text('Meals & Entertainment')),
                DropdownMenuItem(value: 'UTILITIES', child: Text('Office & Tech Utilities')),
                DropdownMenuItem(value: 'OTHER', child: Text('Other Miscellaneous')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _category = val);
              },
            ),
            const SizedBox(height: 16),

            // Amount Input
            const Text('Amount (INR)', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Amount is required';
                final amt = double.tryParse(val.trim());
                if (amt == null || amt <= 0) return 'Enter a valid positive amount';
                return null;
              },
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B).withOpacity(0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                hintText: 'e.g. 1500.00',
                hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),

            // Description Area
            const Text('Description', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descController,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Description is required';
                return null;
              },
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B).withOpacity(0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                hintText: 'e.g. Client dinner receipt / airport taxi',
                hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _submitting ? null : _submitClaim,
              child: _submitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Claim', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
