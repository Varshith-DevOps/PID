# PID hcms Mobile App

Flutter Employee Self Service app for PID hcms.

## Features Included

- Login with saved session.
- Personalized employee dashboard.
- Tap-based metric insights with praise or improvement suggestions.
- Attendance check-in and check-out.
- Today attendance view.
- Assigned tasks and timesheet logging.
- Recent timesheets and overtime view.
- Leave balance view.
- Leave application form.
- Attendance regularization form.
- Payslip history.
- Expense claim submission.
- Expense and travel advance status.
- Profile summary.
- Assigned assets.
- Learning enrollments.
- Helpdesk ticket creation.
- Employee documents list.
- Notifications with mark-as-read.
- Manager/admin pending approvals section when role permits it.

## API Base URL

The API base URL is configured in:

```text
lib/services/api_service.dart
```

Default:

```dart
static String baseUrl = 'http://10.0.2.2:5000/api';
```

Use:

- Android emulator: `http://10.0.2.2:5000/api`
- iOS simulator: `http://localhost:5000/api`
- Physical phone: `http://<your-computer-lan-ip>:5000/api`

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

## Seed Login

After backend seed:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@hrms.com` | `admin123` |
| Manager | `manager@hrms.com` | `admin123` |
| Employee | `rajesh.kumar@company.com` | `employee123` |

Company code can be any local tenant label for now, for example:

```text
pid-hcms
```

## Notes

- File upload from mobile is not yet implemented for receipts/documents. Expense claims can be submitted without a receipt, matching the backend's optional receipt behavior.
- MFA accounts currently require web login completion. Mobile shows a clear message if MFA is required.
- Payslip PDF download is listed as a follow-up for mobile because it needs device file storage permissions and a PDF viewer/download workflow.
