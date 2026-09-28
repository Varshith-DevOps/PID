import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../services/update_service.dart';

const _panel = Color(0xFF111827);
const _line = Color(0xFF263247);
const _text = Color(0xFFE5E7EB);
const _muted = Color(0xFF94A3B8);
const _teal = Color(0xFF2DD4BF);
const _rose = Color(0xFFFB7185);

/// Shows the OTA update dialog. When [info.forced] is true the dialog cannot be
/// dismissed until the update is started. Returns once the user dismisses it.
Future<void> showUpdateDialog(BuildContext context, AppUpdateInfo info) {
  return showDialog<void>(
    context: context,
    barrierDismissible: !info.forced,
    builder: (context) => _UpdateDialog(info: info),
  );
}

class _UpdateDialog extends StatefulWidget {
  final AppUpdateInfo info;

  const _UpdateDialog({required this.info});

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _downloading = false;
  int _percent = 0;
  String? _error;
  OtaStatus? _status;

  void _start() {
    final url = widget.info.apkUrl;
    if (url == null) return;
    setState(() {
      _downloading = true;
      _error = null;
      _percent = 0;
    });

    UpdateService.download(url).listen(
      (progress) {
        if (!mounted) return;
        setState(() {
          _status = progress.status;
          _percent = progress.percent;
        });
      },
      onError: (e) {
        if (!mounted) return;
        setState(() {
          _downloading = false;
          _error = 'Update failed: $e';
        });
      },
    );
  }

  String get _statusLabel {
    switch (_status) {
      case OtaStatus.DOWNLOADING:
        return 'Downloading update… $_percent%';
      case OtaStatus.INSTALLING:
        return 'Opening installer…';
      case OtaStatus.ALREADY_RUNNING_ERROR:
        return 'An update is already in progress.';
      case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
        return 'Please allow installing apps from this source, then retry.';
      case OtaStatus.INTERNAL_ERROR:
      case OtaStatus.DOWNLOAD_ERROR:
        return 'Download error. Check your connection and retry.';
      default:
        return 'Preparing…';
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    return PopScope(
      canPop: !info.forced && !_downloading,
      child: AlertDialog(
        backgroundColor: _panel,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Row(
          children: [
            const Icon(Icons.system_update_alt_rounded, color: _teal),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                info.forced ? 'Update required' : 'Update available',
                style: const TextStyle(color: _text, fontWeight: FontWeight.w800, fontSize: 18),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Version ${info.latestVersion} is available'
                '${info.sizeBytes > 0 ? ' (${info.sizeMb.toStringAsFixed(1)} MB)' : ''}.',
                style: const TextStyle(color: _muted, fontSize: 13),
              ),
              Text('You have ${info.currentVersion}.', style: const TextStyle(color: _muted, fontSize: 12)),
              if (info.releaseNotes.isNotEmpty) ...[
                const SizedBox(height: 14),
                const Text("What's new", style: TextStyle(color: _text, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                ...info.releaseNotes.map((note) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('•  ', style: TextStyle(color: _teal)),
                          Expanded(child: Text(note, style: const TextStyle(color: _muted, fontSize: 13))),
                        ],
                      ),
                    )),
              ],
              if (info.forced) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _rose.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _rose.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'This update is mandatory and must be installed to continue.',
                    style: TextStyle(color: _text, fontSize: 12),
                  ),
                ),
              ],
              if (_downloading) ...[
                const SizedBox(height: 16),
                LinearProgressIndicator(
                  value: _status == OtaStatus.DOWNLOADING && _percent > 0 ? _percent / 100 : null,
                  color: _teal,
                  backgroundColor: _line,
                ),
                const SizedBox(height: 8),
                Text(_statusLabel, style: const TextStyle(color: _muted, fontSize: 12)),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: _rose, fontSize: 12)),
              ],
            ],
          ),
        ),
        actions: [
          if (!info.forced && !_downloading)
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Later', style: TextStyle(color: _muted)),
            ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: _teal, foregroundColor: const Color(0xFF042F2E)),
            onPressed: _downloading && _error == null ? null : _start,
            icon: const Icon(Icons.download_rounded, size: 18),
            label: Text(_error != null ? 'Retry' : 'Update now'),
          ),
        ],
      ),
    );
  }
}
