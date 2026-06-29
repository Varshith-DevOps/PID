import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../main.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/update_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'project_board_screen.dart';
import 'update_dialog.dart';

class SettingsScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const SettingsScreen({super.key, required this.authProvider});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _version = '';
  bool _checkingUpdate = false;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() => _version = '${info.version} (build ${info.buildNumber})');
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    final c = context.colors;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: error ? c.danger : c.accent),
    );
  }

  Future<void> _checkForUpdate() async {
    setState(() => _checkingUpdate = true);
    final info = await UpdateService.check();
    if (!mounted) return;
    setState(() => _checkingUpdate = false);
    if (info == null) {
      _toast('Could not reach the update server.', error: true);
    } else if (info.updateAvailable) {
      await showUpdateDialog(context, info);
    } else {
      _toast("You're on the latest version.");
    }
  }

  Future<void> _changePassword() async {
    final c = context.colors;
    final current = TextEditingController();
    final next = TextEditingController();
    final confirm = TextEditingController();
    String? error;
    bool saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.raised,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(14))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20, bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Change password',
                  style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              _field(current, 'Current password', obscure: true),
              const SizedBox(height: 12),
              _field(next, 'New password', obscure: true),
              const SizedBox(height: 6),
              Text('Min 12 chars with upper, lower, number, and symbol.',
                  style: TextStyle(color: c.textMuted, fontSize: 11)),
              const SizedBox(height: 12),
              _field(confirm, 'Confirm new password', obscure: true),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: c.danger, fontSize: 13)),
              ],
              const SizedBox(height: 18),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: c.accent,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: saving
                    ? null
                    : () async {
                        if (next.text != confirm.text) {
                          setSheetState(() => error = 'New passwords do not match.');
                          return;
                        }
                        setSheetState(() {
                          saving = true;
                          error = null;
                        });
                        try {
                          await ApiService.putJson('/auth/change-password', {
                            'currentPassword': current.text,
                            'newPassword': next.text,
                          });
                          if (sheetContext.mounted) Navigator.pop(sheetContext);
                          _toast('Password changed successfully.');
                        } catch (e) {
                          setSheetState(() {
                            saving = false;
                            error = e.toString();
                          });
                        }
                      },
                child: saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Text('Update password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _exportMyData() async {
    final employeeId = widget.authProvider.employeeId;
    if (employeeId == null) {
      _toast('Your login is not linked to an employee profile.', error: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final response = await ApiService.get('/employees/$employeeId/data-export');
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiService.errorFor(response);
      }
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/pid-hcms-my-data.json');
      await file.writeAsBytes(response.bodyBytes);
      if (!mounted) return;
      setState(() => _exporting = false);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'application/json')],
        subject: 'My PID hcms personal data export',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _exporting = false);
      _toast(e.toString(), error: true);
    }
  }

  void _showPrivacyNotice() {
    final c = context.colors;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: c.raised,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Your data rights', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w800)),
        content: Text(
          'Under the Digital Personal Data Protection (DPDP) Act, you can access a '
          'copy of the personal data PID hcms holds about you. Use "Download my data" '
          'to export your profile, attendance, leave, payroll, expense, and timesheet '
          'records. Statutory payroll and tax records are retained by law even after '
          'erasure requests. To correct or erase data, raise a request with HR.',
          style: TextStyle(color: c.textSecondary, fontSize: 13),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Got it'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = widget.authProvider.user ?? const {};
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: c.navInk,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white70),
        title: const Text('Settings', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const _SectionLabel('Account'),
          _Card(children: [
            _Row(icon: Icons.person_outline, title: user['name']?.toString() ?? 'Employee', subtitle: user['email']?.toString() ?? ''),
            Divider(color: c.border, height: 1),
            _Tile(icon: Icons.lock_outline, title: 'Change password', onTap: _changePassword),
          ]),
          const SizedBox(height: 18),
          const _SectionLabel('Appearance'),
          _Card(children: [
            // Theme selector wired to the global themeController.
            ListenableBuilder(
              listenable: themeController,
              builder: (context, _) {
                final mode = themeController.mode;
                return Column(
                  children: [
                    _ThemeOption(
                      icon: Icons.light_mode_outlined,
                      title: 'Light',
                      subtitle: 'Bright, default appearance',
                      selected: mode == ThemeMode.light,
                      onTap: () => themeController.setMode(ThemeMode.light),
                    ),
                    Divider(color: c.border, height: 1),
                    _ThemeOption(
                      icon: Icons.dark_mode_outlined,
                      title: 'Dark',
                      subtitle: 'Easier on the eyes in low light',
                      selected: mode == ThemeMode.dark,
                      onTap: () => themeController.setMode(ThemeMode.dark),
                    ),
                    Divider(color: c.border, height: 1),
                    _ThemeOption(
                      icon: Icons.brightness_auto_outlined,
                      title: 'System',
                      subtitle: 'Match your device setting',
                      selected: mode == ThemeMode.system,
                      onTap: () => themeController.setMode(ThemeMode.system),
                    ),
                  ],
                );
              },
            ),
          ]),
          const SizedBox(height: 18),
          const _SectionLabel('Workspace'),
          _Card(children: [
            _Tile(
              icon: Icons.view_kanban_outlined,
              title: 'Project board',
              subtitle: 'View and move your tasks',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProjectBoardScreen())),
            ),
          ]),
          const SizedBox(height: 18),
          const _SectionLabel('Privacy & data (DPDP)'),
          _Card(children: [
            _Tile(
              icon: Icons.download_outlined,
              title: 'Download my data',
              subtitle: 'Export a copy of your personal data',
              trailing: _exporting ? const _Spinner() : null,
              onTap: _exporting ? null : _exportMyData,
            ),
            Divider(color: c.border, height: 1),
            _Tile(icon: Icons.privacy_tip_outlined, title: 'Your data rights', onTap: _showPrivacyNotice),
          ]),
          const SizedBox(height: 18),
          const _SectionLabel('App'),
          _Card(children: [
            _Row(icon: Icons.info_outline, title: 'Version', subtitle: _version),
            Divider(color: c.border, height: 1),
            _Tile(
              icon: Icons.system_update_alt_outlined,
              title: 'Check for updates',
              subtitle: 'Download the latest version over the internet',
              trailing: _checkingUpdate ? const _Spinner() : null,
              onTap: _checkingUpdate ? null : _checkForUpdate,
            ),
          ]),
          const SizedBox(height: 18),
          _Card(children: [
            _Tile(
              icon: Icons.logout_rounded,
              title: 'Log out',
              color: c.danger,
              onTap: () async {
                await widget.authProvider.logout();
                if (!context.mounted) return;
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => LoginScreen(authProvider: widget.authProvider)),
                  (route) => false,
                );
              },
            ),
          ]),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String hint, {bool obscure = false}) {
    final col = context.colors;
    return TextField(
      controller: c,
      obscureText: obscure,
      style: TextStyle(color: col.textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: col.textMuted),
        filled: true,
        fillColor: col.sunken,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: col.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: col.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: col.accent)),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(text.toUpperCase(),
            style: TextStyle(color: context.colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
      );
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(color: c.raised, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.border)),
      child: Column(children: children),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _Row({required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListTile(
      leading: Icon(icon, color: c.textMuted),
      title: Text(title, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700)),
      subtitle: subtitle.isEmpty ? null : Text(subtitle, style: TextStyle(color: c.textMuted, fontSize: 12)),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Color? color;
  final VoidCallback? onTap;
  const _Tile({required this.icon, required this.title, this.subtitle, this.trailing, this.color, this.onTap});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final titleColor = color ?? c.textPrimary;
    return ListTile(
      leading: Icon(icon, color: color ?? c.accent),
      title: Text(title, style: TextStyle(color: titleColor, fontWeight: FontWeight.w700)),
      subtitle: subtitle == null ? null : Text(subtitle!, style: TextStyle(color: c.textMuted, fontSize: 12)),
      trailing: trailing ?? (onTap != null ? Icon(Icons.chevron_right, color: c.textMuted) : null),
      onTap: onTap,
    );
  }
}

class _ThemeOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  const _ThemeOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListTile(
      leading: Icon(icon, color: selected ? c.accent : c.textMuted),
      title: Text(title, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700)),
      subtitle: Text(subtitle, style: TextStyle(color: c.textMuted, fontSize: 12)),
      trailing: selected
          ? Icon(Icons.check_circle, color: c.accent)
          : Icon(Icons.radio_button_unchecked, color: c.textMuted),
      onTap: onTap,
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) =>
      SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: context.colors.accent, strokeWidth: 2));
}
