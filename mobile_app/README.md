# PID hcms Mobile App

Flutter Employee Self Service app for PID hcms. **v2.0.0**

## Features Included

- Login with saved session.
- **Two-factor (MFA) login** — enter your authenticator code or a recovery code right in the app.
- Personalized employee dashboard.
- Tap-based metric insights with praise or improvement suggestions.
- Attendance check-in and check-out.
- Today attendance view.
- Assigned tasks and timesheet logging.
- **Jira-style Project Board** — pick a project, see tasks by column, and move a task to a new status.
- Recent timesheets and overtime view.
- Leave balance view, leave application, attendance regularization.
- Payslip history.
- Expense claim submission, expense and travel advance status.
- Profile summary, assigned assets, learning enrollments.
- Helpdesk ticket creation, employee documents list.
- Notifications with mark-as-read.
- Manager/admin pending approvals section when role permits it.
- **Settings** (gear icon, top-right): change password, project board, privacy & data, app version, check for updates.
- **DPDP data export** — download a copy of your personal data and share it.
- **Over-the-air (OTA) updates** — the app checks the backend on launch and from
  Settings → *Check for updates*, then downloads and installs the new APK.

## API Base URL

Configured in [lib/services/api_service.dart](lib/services/api_service.dart):

```dart
static String baseUrl = 'http://10.0.2.2:5000/api';
```

- Android emulator: `http://10.0.2.2:5000/api`
- iOS simulator: `http://localhost:5000/api`
- Physical phone: `http://<your-computer-lan-ip>:5000/api`

> The release APK enables `usesCleartextTraffic` so it can reach an `http`
> self-hosted/LAN backend. Use HTTPS in production.

## Run Locally

Start backend first:

```powershell
cd e:\HRMS_application\backend
npm run dev
```

Then run mobile app:

```powershell
cd e:\HRMS_application\mobile_app
flutter pub get
flutter run
```

## Over-the-air (OTA) updates

How it works:

1. The backend serves a **version manifest** at `GET /api/app/version` and the
   **APK** at `GET /api/app/download` (see
   [backend/app-release/app-version.json](../backend/app-release/app-version.json)
   and `backend/src/controllers/appUpdateController.js`). Both are public so the
   app can update even before login.
2. On launch — and from **Settings → Check for updates** — the app calls
   `/app/version`, compares `latestVersionCode` against its own build number, and
   if newer prompts the user. `mandatory: true` (or a build older than
   `minSupportedVersionCode`) blocks the app until updated.
3. The app downloads the APK and launches the Android installer. The user must
   allow "install unknown apps" for this app once.

### Cutting a new release

1. Bump `version:` in [pubspec.yaml](pubspec.yaml) — increment BOTH the name and
   the build number, e.g. `2.1.0+3`.
2. Build the signed APK (see below).
3. Copy the APK into `backend/app-release/` and update
   `backend/app-release/app-version.json`:
   - `latestVersion` / `latestVersionCode` → match the new build,
   - `apkFileName` → the new file name,
   - `releaseNotes`, `releasedAt`, and `mandatory` as needed.

## Building the release APK

Signing is configured via `android/key.properties` + a keystore
(`android/app/pid-hcms-release.jks`). **Keep this keystore safe and reuse it for
every release** — OTA updates only install over an existing app when signed with
the same key. Both files are git-ignored.

```powershell
cd e:\HRMS_application\mobile_app
flutter build apk --release
# Output: build\app\outputs\flutter-apk\app-release.apk
```

To regenerate the keystore (only for a brand-new app identity):

```powershell
keytool -genkeypair -v -keystore android\app\pid-hcms-release.jks -storetype JKS `
  -keyalg RSA -keysize 2048 -validity 10000 -alias pidhcms
```

## Seed Login

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@hrms.com` | `admin123` |
| Manager | `manager@hrms.com` | `admin123` |
| Employee | `rajesh.kumar@company.com` | `employee123` |

Company code can be any local tenant label, for example `pid-hcms`.

## Notes

- File upload from mobile is not yet implemented for receipts/documents. Expense
  claims can be submitted without a receipt.
- Project board task moves require project EDIT permission; viewers see a clear
  access message if they try to move a task.
- Payslip PDF download is a follow-up for mobile (needs device storage + a PDF
  viewer workflow).
