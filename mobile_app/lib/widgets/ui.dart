import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Shared, theme-aware widgets for the PID hcms mobile ESS app.
/// Mirrors the web component library so both clients feel consistent.

class PrimaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool loading;
  final bool fullWidth;
  const PrimaryButton({super.key, required this.label, this.icon, this.onPressed, this.loading = false, this.fullWidth = false});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final btn = FilledButton.icon(
      onPressed: loading ? null : onPressed,
      icon: loading
          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : (icon != null ? Icon(icon, size: 18) : const SizedBox.shrink()),
      label: Text(label),
      style: FilledButton.styleFrom(
        backgroundColor: c.accent,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}

class SecondaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  const SecondaryButton({super.key, required this.label, this.icon, this.onPressed});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: icon != null ? Icon(icon, size: 18) : const SizedBox.shrink(),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: c.textSecondary,
        side: BorderSide(color: c.border),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: c.raised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: child,
    );
    if (onTap == null) return body;
    return InkWell(borderRadius: BorderRadius.circular(14), onTap: onTap, child: body);
  }
}

enum ChipTone { success, warning, danger, info, neutral, leave, payroll }

class StatusChip extends StatelessWidget {
  final String label;
  final ChipTone? tone;
  const StatusChip({super.key, required this.label, this.tone});

  ChipTone _auto(String s) {
    final u = s.toUpperCase();
    if (['APPROVED', 'ACTIVE', 'PAID', 'COMPLETED', 'PRESENT', 'SUCCESS', 'SETTLED'].contains(u)) return ChipTone.success;
    if (['PENDING', 'IN_PROGRESS', 'REVIEW', 'LATE', 'HALF_DAY', 'AWAITING_APPROVAL'].contains(u)) return ChipTone.warning;
    if (['REJECTED', 'FAILED', 'ABSENT', 'OVERDUE', 'HIGH'].contains(u)) return ChipTone.danger;
    if (['ON_LEAVE'].contains(u)) return ChipTone.leave;
    if (['WFH', 'OPEN'].contains(u)) return ChipTone.info;
    return ChipTone.neutral;
  }

  Color _color(BuildContext context, ChipTone t) {
    final c = context.colors;
    switch (t) {
      case ChipTone.success: return c.success;
      case ChipTone.warning: return c.warning;
      case ChipTone.danger: return c.danger;
      case ChipTone.info: return c.info;
      case ChipTone.leave: return c.leave;
      case ChipTone.payroll: return c.payroll;
      case ChipTone.neutral: return c.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = tone ?? _auto(label);
    final color = _color(context, t);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? action;
  const SectionHeader({super.key, required this.title, this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(color: context.colors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
          if (action != null) action!,
        ],
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? accent;
  final VoidCallback? onTap;
  const MetricTile({super.key, required this.label, required this.value, required this.icon, this.accent, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final a = accent ?? c.accent;
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: a.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: a, size: 18),
            ),
          ]),
          const SizedBox(height: 12),
          Text(value, style: TextStyle(color: c.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          Text(label, style: TextStyle(color: c.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  final String? label;
  const LoadingView({super.key, this.label});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        CircularProgressIndicator(color: context.colors.accent),
        if (label != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(label!, style: TextStyle(color: context.colors.textMuted))),
      ]),
    );
  }
}

class EmptyView extends StatelessWidget {
  final IconData icon;
  final String message;
  const EmptyView({super.key, this.icon = Icons.inbox_outlined, required this.message});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: c.textMuted),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: TextStyle(color: c.textMuted)),
        ]),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorView({super.key, required this.message, this.onRetry});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.error_outline, size: 40, color: c.danger),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary)),
          if (onRetry != null) Padding(
            padding: const EdgeInsets.only(top: 12),
            child: SecondaryButton(label: 'Retry', icon: Icons.refresh, onPressed: onRetry),
          ),
        ]),
      ),
    );
  }
}

/// Standard bottom-sheet frame: title + close + scrollable, keyboard-aware body.
class SheetForm extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const SheetForm({super.key, required this.title, required this.children});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(title, style: TextStyle(color: c.textPrimary, fontSize: 17, fontWeight: FontWeight.w700)),
          IconButton(onPressed: () => Navigator.of(context).pop(), icon: Icon(Icons.close, color: c.textMuted)),
        ]),
        const SizedBox(height: 8),
        ...children,
      ]),
    );
  }
}
