import 'package:flutter/material.dart';

/// Semantic color tokens mirroring the web design system
/// (src/styles/tokens.css). Available via `Theme.of(context).extension<AppColors>()`
/// or the `context.colors` helper below. Light is the default; dark is opt-in.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  final Color canvas;
  final Color raised;
  final Color sunken;
  final Color navInk; // deep-ink nav surface in both themes
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color border;
  final Color accent;
  final Color trust;
  final Color success;
  final Color warning;
  final Color danger;
  final Color info;
  final Color leave;
  final Color payroll;

  const AppColors({
    required this.canvas,
    required this.raised,
    required this.sunken,
    required this.navInk,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.accent,
    required this.trust,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.leave,
    required this.payroll,
  });

  static const light = AppColors(
    canvas: Color(0xFFF6F8FA),
    raised: Color(0xFFFFFFFF),
    sunken: Color(0xFFEEF1F5),
    navInk: Color(0xFF0A0E1A),
    textPrimary: Color(0xFF0F1623),
    textSecondary: Color(0xFF4B5563),
    textMuted: Color(0xFF6B7787),
    border: Color(0xFFE2E7EE),
    accent: Color(0xFF00A7B5),
    trust: Color(0xFF182B6D),
    success: Color(0xFF059669),
    warning: Color(0xFFD97706),
    danger: Color(0xFFDC2626),
    info: Color(0xFF0E7490),
    leave: Color(0xFF7C3AED),
    payroll: Color(0xFF0E7490),
  );

  static const dark = AppColors(
    canvas: Color(0xFF0A0E1A),
    raised: Color(0xFF111827),
    sunken: Color(0xFF0B1120),
    navInk: Color(0xFF0A0E1A),
    textPrimary: Color(0xFFF2F4F7),
    textSecondary: Color(0xFF94A3B8),
    textMuted: Color(0xFF64748B),
    border: Color(0xFF263247),
    accent: Color(0xFF00A7B5),
    trust: Color(0xFF00A7B5),
    success: Color(0xFF34D399),
    warning: Color(0xFFFBBF24),
    danger: Color(0xFFFB7185),
    info: Color(0xFF73E0E7),
    leave: Color(0xFFA78BFA),
    payroll: Color(0xFF5AD7E2),
  );

  @override
  AppColors copyWith({
    Color? canvas, Color? raised, Color? sunken, Color? navInk,
    Color? textPrimary, Color? textSecondary, Color? textMuted, Color? border,
    Color? accent, Color? trust, Color? success, Color? warning, Color? danger,
    Color? info, Color? leave, Color? payroll,
  }) {
    return AppColors(
      canvas: canvas ?? this.canvas,
      raised: raised ?? this.raised,
      sunken: sunken ?? this.sunken,
      navInk: navInk ?? this.navInk,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      border: border ?? this.border,
      accent: accent ?? this.accent,
      trust: trust ?? this.trust,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      info: info ?? this.info,
      leave: leave ?? this.leave,
      payroll: payroll ?? this.payroll,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      raised: Color.lerp(raised, other.raised, t)!,
      sunken: Color.lerp(sunken, other.sunken, t)!,
      navInk: Color.lerp(navInk, other.navInk, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      trust: Color.lerp(trust, other.trust, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      info: Color.lerp(info, other.info, t)!,
      leave: Color.lerp(leave, other.leave, t)!,
      payroll: Color.lerp(payroll, other.payroll, t)!,
    );
  }
}

extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>() ?? AppColors.light;
}

class AppTheme {
  static ThemeData _build(AppColors c, Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      primaryColor: c.accent,
      scaffoldBackgroundColor: c.canvas,
      fontFamily: 'Roboto',
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.accent,
        onPrimary: Colors.white,
        secondary: const Color(0xFFFFB23F),
        onSecondary: const Color(0xFF1D2433),
        surface: c.raised,
        onSurface: c.textPrimary,
        error: c.danger,
        onError: Colors.white,
      ),
      textTheme: TextTheme(
        headlineSmall: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w800),
        titleMedium: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700),
        bodyLarge: TextStyle(color: c.textPrimary),
        bodyMedium: TextStyle(color: c.textSecondary),
        bodySmall: TextStyle(color: c.textMuted),
      ),
      cardTheme: CardTheme(
        color: c.raised,
        elevation: isDark ? 0 : 1,
        shadowColor: Colors.black.withOpacity(0.08),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: c.border),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: c.navInk,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.raised,
        indicatorColor: c.accent.withOpacity(0.16),
        labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11, color: c.textSecondary)),
      ),
      dividerColor: c.border,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? const Color(0xFF172033) : c.sunken,
        hintStyle: TextStyle(color: c.textMuted),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: c.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: c.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: c.accent, width: 1.5)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFF1D2433),
        contentTextStyle: const TextStyle(color: Color(0xFFE5E7EB)),
      ),
      extensions: const [],
    ).copyWith(extensions: [c]);
  }

  static ThemeData get light => _build(AppColors.light, Brightness.light);
  static ThemeData get dark => _build(AppColors.dark, Brightness.dark);
}
