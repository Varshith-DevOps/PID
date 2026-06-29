import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class AttendanceScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const AttendanceScreen({super.key, required this.authProvider});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = true;
  bool _isCheckedIn = false;
  DateTime? _checkInTime;
  String _timeString = '00:00:00';
  Timer? _timer;
  double _swipeProgress = 0.0;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    try {
      // Get attendance status from backend
      final res = await ApiService.get('/attendance/status');
      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data != null && data['checkedIn'] == true) {
          final timeStr = data['checkInTime'];
          setState(() {
            _isCheckedIn = true;
            if (timeStr != null) {
              _checkInTime = DateTime.parse(timeStr);
              _startTimer();
            }
          });
        }
      }
      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_checkInTime == null) return;
      final duration = DateTime.now().difference(_checkInTime!);
      final hours = duration.inHours.toString().padLeft(2, '0');
      final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
      final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');

      if (mounted) {
        setState(() {
          _timeString = '$hours:$minutes:$seconds';
        });
      }
    });
  }

  Future<void> _handleSwipeCompleted() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final actionStatus = _isCheckedIn ? 'ABSENT' : 'PRESENT'; // ABSENT clocks out, PRESENT clocks in

    try {
      final res = await ApiService.post('/attendance/mark', {
        'employeeId': widget.authProvider.user?['id'],
        'date': DateTime.now().toIso8601String(),
        'status': actionStatus,
        'latitude': 12.9716, // Mock location details
        'longitude': 77.5946,
      });

      if (!mounted) return;

      if (res.statusCode == 200 || res.statusCode == 201) {
        setState(() {
          _isCheckedIn = !_isCheckedIn;
          if (_isCheckedIn) {
            _checkInTime = DateTime.now();
            _startTimer();
          } else {
            _timer?.cancel();
            _checkInTime = null;
            _timeString = '00:00:00';
          }
        });
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _errorMessage = data['error'] ?? 'Action blocked by business policy.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error. Please try again.';
      });
    } finally {
      setState(() {
        _isLoading = false;
        _swipeProgress = 0.0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (_isLoading) {
      return Scaffold(
        backgroundColor: c.canvas,
        body: Center(child: CircularProgressIndicator(color: c.accent)),
      );
    }

    // The active/clock-in accent vs. the clock-out (danger) accent.
    final actionColor = _isCheckedIn ? c.danger : c.accent;
    final currentDateStr = DateFormat('EEEE, MMMM d, y').format(DateTime.now());

    return Scaffold(
      backgroundColor: c.canvas,
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Info
            Column(
              children: [
                Text(
                  currentDateStr,
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _isCheckedIn ? 'Shift Active' : 'Not Checked In',
                  style: TextStyle(
                    color: _isCheckedIn ? c.success : c.danger,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),

            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12.0),
                decoration: BoxDecoration(
                  color: c.danger.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.danger.withOpacity(0.2)),
                ),
                child: Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.danger, fontSize: 13),
                ),
              ),

            // Visual Timer Display
            Center(
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: c.raised,
                  border: Border.all(
                    color: _isCheckedIn ? c.accent.withOpacity(0.3) : c.border,
                    width: 6,
                  ),
                  boxShadow: [
                    if (_isCheckedIn)
                      BoxShadow(
                        color: c.accent.withOpacity(0.15),
                        blurRadius: 40,
                        spreadRadius: 2,
                      ),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.fingerprint_rounded,
                      color: _isCheckedIn ? c.accent : c.textMuted,
                      size: 48,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _timeString,
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'TOTAL WORK HOURS',
                      style: TextStyle(
                        color: c.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Swipe Action Slider
            Column(
              children: [
                Text(
                  _isCheckedIn ? 'Swipe right to Clock Out' : 'Swipe right to Clock In',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 18),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final sliderWidth = constraints.maxWidth;
                    const handleSize = 50.0;
                    final maxDrag = sliderWidth - handleSize - 8.0;

                    return Container(
                      height: 58,
                      decoration: BoxDecoration(
                        color: c.raised,
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: c.border),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Stack(
                        alignment: Alignment.centerLeft,
                        children: [
                          // Inner slide track text
                          Center(
                            child: Opacity(
                              opacity: (1.0 - (_swipeProgress / maxDrag)).clamp(0.0, 1.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.double_arrow_rounded,
                                    color: actionColor.withOpacity(0.6),
                                    size: 16,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    _isCheckedIn ? 'SLIDE TO CHECK-OUT' : 'SLIDE TO CHECK-IN',
                                    style: TextStyle(
                                      color: actionColor.withOpacity(0.7),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Drag Handle
                          Positioned(
                            left: _swipeProgress,
                            child: GestureDetector(
                              onHorizontalDragUpdate: (details) {
                                setState(() {
                                  _swipeProgress = (_swipeProgress + details.delta.dx).clamp(0.0, maxDrag);
                                });
                              },
                              onHorizontalDragEnd: (details) {
                                if (_swipeProgress >= maxDrag * 0.85) {
                                  _handleSwipeCompleted();
                                } else {
                                  setState(() {
                                    _swipeProgress = 0.0;
                                  });
                                }
                              },
                              child: Container(
                                width: handleSize,
                                height: handleSize,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    colors: _isCheckedIn
                                        ? [c.danger, c.danger.withOpacity(0.7)]
                                        : [c.accent, c.accent.withOpacity(0.7)],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: actionColor.withOpacity(0.3),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  _isCheckedIn ? Icons.power_settings_new_rounded : Icons.login_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
