import 'package:flutter/material.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import 'dashboard_shell.dart';

class LoginScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const LoginScreen({super.key, required this.authProvider});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  String? _errorMessage;
  bool _isLoading = false;

  @override
  void dispose() {
    _companyController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await widget.authProvider.login(
      companyCode: _companyController.text,
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      _goToDashboard();
    } else if (result.mfaRequired) {
      await _promptMfa();
    } else {
      setState(() => _errorMessage = result.error);
    }
  }

  void _goToDashboard() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => DashboardShell(authProvider: widget.authProvider),
      ),
    );
  }

  /// Shows the MFA challenge sheet after a password login flagged `mfaRequired`.
  Future<void> _promptMfa() async {
    final c = context.colors;
    final codeController = TextEditingController();
    bool useRecovery = false;
    String? sheetError;
    bool verifying = false;

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.raised,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 22,
            right: 22,
            top: 22,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 22,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.shield_outlined, color: c.accent),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('Two-factor verification',
                        style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(sheetContext, false),
                    icon: Icon(Icons.close, color: c.textMuted),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                useRecovery
                    ? 'Enter one of your saved recovery codes.'
                    : 'Enter the 6-digit code from your authenticator app.',
                style: TextStyle(color: c.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                autofocus: true,
                keyboardType: useRecovery ? TextInputType.text : TextInputType.number,
                style: TextStyle(color: c.textPrimary, fontSize: 18, letterSpacing: 2),
                decoration: InputDecoration(
                  hintText: useRecovery ? 'Recovery code' : '123456',
                  hintStyle: TextStyle(color: c.textMuted),
                  filled: true,
                  fillColor: c.sunken,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              if (sheetError != null) ...[
                const SizedBox(height: 10),
                Text(sheetError!, style: TextStyle(color: c.danger, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: c.accent, minimumSize: const Size.fromHeight(48)),
                onPressed: verifying
                    ? null
                    : () async {
                        setSheetState(() {
                          verifying = true;
                          sheetError = null;
                        });
                        final res = await widget.authProvider.verifyMfa(
                          code: useRecovery ? null : codeController.text,
                          recoveryCode: useRecovery ? codeController.text : null,
                        );
                        if (res.success) {
                          if (sheetContext.mounted) Navigator.pop(sheetContext, true);
                        } else {
                          setSheetState(() {
                            verifying = false;
                            sheetError = res.error;
                          });
                        }
                      },
                child: verifying
                    ? const SizedBox(
                        height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Text('Verify', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
              TextButton(
                onPressed: () => setSheetState(() {
                  useRecovery = !useRecovery;
                  sheetError = null;
                  codeController.clear();
                }),
                child: Text(
                  useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead',
                  style: TextStyle(color: c.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted) return;
    if (ok == true) {
      _goToDashboard();
    } else {
      setState(() => _errorMessage = 'Two-factor verification was not completed.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    // The login is a deliberate branded splash: a deep-ink hero with the brand
    // gradient. It stays dark in both themes for brand consistency, but routes
    // its accents through tokens.
    return Scaffold(
      backgroundColor: c.navInk,
      body: Stack(
        children: [
          // Background Gradient Circles for Glow Effect
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: c.accent.withValues(alpha: 0.12),
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF182B6D).withValues(alpha: 0.12),
              ),
            ),
          ),
          // Content
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 36.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 60),
                  Center(
                    child: Image.asset(
                      'assets/brand/pid_hcms_logo.png',
                      height: 92,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'PID hcms',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Employee Self-Service Portal',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: Color(0xFF94A3B8),
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  const SizedBox(height: 48),

                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(14.0),
                      decoration: BoxDecoration(
                        color: c.danger.withValues(alpha: 0.12),
                        border: Border.all(color: c.danger.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, color: c.danger, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: TextStyle(color: c.danger, fontSize: 13.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Company Tenant Code Input
                        _buildInputField(
                          controller: _companyController,
                          label: 'Company Tenant Code',
                          hint: 'e.g. acme',
                          icon: Icons.business_rounded,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Company code is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),
                        // Email Input
                        _buildInputField(
                          controller: _emailController,
                          label: 'Work Email Address',
                          hint: 'admin@acme.com',
                          icon: Icons.email_outlined,
                          keyboardType: TextInputType.emailAddress,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Email is required';
                            }
                            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value.trim())) {
                              return 'Enter a valid email address';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),
                        // Password Input
                        _buildInputField(
                          controller: _passwordController,
                          label: 'Password',
                          hint: '••••••••••••',
                          icon: Icons.lock_outline_rounded,
                          obscureText: _obscurePassword,
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: const Color(0xFF64748B),
                              size: 20,
                            ),
                            onPressed: () {
                              setState(() {
                                _obscurePassword = !_obscurePassword;
                              });
                            },
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Password is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 36),

                        // Submit Button — keeps the brand gradient.
                        Container(
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF182B6D), Color(0xFF0B7890), Color(0xFF00A7B5)],
                            ),
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: c.accent.withValues(alpha: 0.2),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            onPressed: _isLoading ? null : _handleLogin,
                            child: _isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5,
                                    ),
                                  )
                                : const Text(
                                    'Secure Login',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label sits on the dark hero, so it stays light in both themes.
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(color: Colors.white, fontSize: 15),
          cursorColor: c.accent,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 14),
            prefixIcon: Icon(icon, color: const Color(0xFF64748B), size: 20),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: const Color(0xFF1E293B).withValues(alpha: 0.4),
            contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
            errorStyle: TextStyle(color: c.danger),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: const Color(0xFF334155).withValues(alpha: 0.5)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: const Color(0xFF334155).withValues(alpha: 0.5)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: c.accent, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: c.danger, width: 1),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: c.danger, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
