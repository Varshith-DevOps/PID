import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ota_update/ota_update.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api_service.dart';

/// Describes an available release returned by the backend manifest
/// (`GET /api/app/version`).
class AppUpdateInfo {
  final String latestVersion;
  final int latestVersionCode;
  final int minSupportedVersionCode;
  final bool mandatory;
  final List<String> releaseNotes;
  final String? releasedAt;
  final String? apkUrl;
  final bool apkAvailable;
  final int sizeBytes;

  /// The build number of the currently installed app.
  final int currentVersionCode;

  /// The version name of the currently installed app.
  final String currentVersion;

  AppUpdateInfo({
    required this.latestVersion,
    required this.latestVersionCode,
    required this.minSupportedVersionCode,
    required this.mandatory,
    required this.releaseNotes,
    required this.releasedAt,
    required this.apkUrl,
    required this.apkAvailable,
    required this.sizeBytes,
    required this.currentVersionCode,
    required this.currentVersion,
  });

  /// A newer build is on the server and can actually be installed.
  bool get updateAvailable => latestVersionCode > currentVersionCode && apkAvailable;

  /// The user must update before continuing (release flagged mandatory, or the
  /// installed build is older than the minimum the backend still supports).
  bool get forced =>
      updateAvailable && (mandatory || currentVersionCode < minSupportedVersionCode);

  double get sizeMb => sizeBytes / (1024 * 1024);
}

/// Handles checking the backend for a newer build and downloading + installing
/// the APK over the air. Android only — on other platforms the check simply
/// reports that no update is available.
class UpdateService {
  /// Queries the backend manifest and compares it with the installed build.
  /// Returns `null` if the check fails (e.g. server unreachable) so callers can
  /// fail silently on launch.
  static Future<AppUpdateInfo?> check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final currentCode = int.tryParse(info.buildNumber) ?? 0;

      final response = await http
          .get(Uri.parse('${ApiService.baseUrl}/app/version'))
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) return null;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return AppUpdateInfo(
        latestVersion: data['latestVersion']?.toString() ?? info.version,
        latestVersionCode: (data['latestVersionCode'] as num?)?.toInt() ?? 0,
        minSupportedVersionCode: (data['minSupportedVersionCode'] as num?)?.toInt() ?? 0,
        mandatory: data['mandatory'] == true,
        releaseNotes: (data['releaseNotes'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        releasedAt: data['releasedAt']?.toString(),
        apkUrl: data['apkUrl']?.toString(),
        apkAvailable: data['apkAvailable'] == true,
        sizeBytes: (data['sizeBytes'] as num?)?.toInt() ?? 0,
        currentVersionCode: currentCode,
        currentVersion: info.version,
      );
    } catch (_) {
      return null;
    }
  }

  /// Downloads and installs the APK, emitting progress events. The stream yields
  /// the OTA status plus a 0–100 percentage. When the download completes Android
  /// shows the system installer; [OtaStatus.INSTALLING] is the terminal success.
  static Stream<OtaProgress> download(String apkUrl) async* {
    await for (final event in OtaUpdate().execute(apkUrl, destinationFilename: 'pid-hcms-update.apk')) {
      yield OtaProgress(
        status: event.status,
        percent: int.tryParse(event.value ?? '') ?? 0,
      );
    }
  }
}

class OtaProgress {
  final OtaStatus status;
  final int percent;

  OtaProgress({required this.status, required this.percent});
}
