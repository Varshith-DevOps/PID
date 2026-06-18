# PID hcms - Production End-to-End Test Strategy

## Clarifying Questions And Assumptions

### Clarifying Questions
- What is the final product name for release branding? Current repo/docs use `PID hcms`.
- Is production intended for web only, or web plus the Flutter mobile app?
- Which deployment target is final: cloud, on-premise, or hybrid?
- Which integrations are real in production versus mocked: email, payment gateway, biometric devices, bank files, job portals, SSO, WhatsApp/SMS?
- What are the final payroll jurisdictions besides India, if any?
- What are expected production scale targets: tenants, employees per tenant, monthly payroll size, concurrent users?

### Working Assumptions
- Application name: PID hcms.
- Platform: Web application with mobile app code present.
- Stack: Next.js frontend, Express.js backend, Prisma ORM, SQLite in local/dev.
- Enterprise mode: multi-company SaaS with KYC, subscriptions, RBAC, and tenant-aware access.
- Target users: Super Admin, Admin, HR, Manager, Employee, Recruiter, Onboarding, Accounts, Finance, Payroll Reviewer, Payroll Approver, Sales.

---

## A. HRMS Application Summary

PID hcms is an enterprise HRMS intended to centralize employee data, attendance, leave, payroll, statutory compliance, recruitment, projects, expenses, performance, learning, assets, helpdesk, notifications, and SaaS tenant administration.

Core business problems solved:
- Replaces fragmented HR spreadsheets and disconnected payroll records.
- Provides one employee master with personal, statutory, salary, bank, dependent, document, and lifecycle history.
- Automates attendance, leave, shift, overtime, and payroll inputs.
- Supports Indian statutory payroll outputs such as PF, ESIC, professional tax, LWF, TDS, Form 16, and reports.
- Enables employee self-service and manager self-service.
- Supports tenant onboarding, KYC gating, subscriptions, and platform administration.

Expected outcomes:
- Accurate employee lifecycle tracking from recruitment to exit.
- Reduced payroll and compliance errors.
- Faster manager approvals.
- Secure role-based access to salary and personal data.
- Auditability for HR, payroll, reports, and sensitive changes.

---

## B. Module-Wise Feature Breakdown

### 1. Authentication, MFA, Session, Signup
- Purpose: authenticate users and protect HR/payroll data.
- Features: login, signup, admin registration, profile fetch, password change, password reset by admin, MFA setup/enable/disable/verify, JWT cookie/header auth.
- Inputs: email, password, MFA code, recovery code, signup company data.
- Outputs: token, user profile, permissions, company/subscription/KYC metadata.
- CRUD: create user/signup/register; update password/MFA; read profile.
- Validations: credentials, active user, MFA purpose, rate limits, subscription/KYC gating.
- Dependencies: User, Company, Permission, Subscription, MFA service.
- Failure scenarios: invalid password, inactive account, expired token, pending KYC restrictions, missing CIN, expired subscription, MFA failure.
- Reports/audit: login activity and security audit expectations.

### 2. RBAC And Permissions
- Purpose: restrict module/action access by role and user overrides.
- Features: role permissions, user permissions, reset defaults, custom modules, sidebar visibility.
- Actions: VIEW, CREATE, EDIT, DELETE, EXPORT.
- Dependencies: Permission table, auth middleware, RBAC middleware.
- Failure scenarios: stale explicit denies, incorrect sidebar exposure, API accepts unauthorized action, employee sees salary data outside scope.

### 3. Platform, Tenant, KYC, Billing
- Purpose: SaaS administration for companies and subscriptions.
- Features: company setup, KYC update/verification, legal entities, branches, locations, plans, subscriptions, checkout/confirm payment, platform admin metrics.
- Inputs: company profile, CIN, KYC status, plan id, transaction data, company status.
- Outputs: active tenant access, feature limits, subscription records, payment transactions.
- Dependencies: Company, Plan, Subscription, PaymentTransaction, platform admin routes.
- Failure scenarios: pending/rejected KYC, missing CIN, expired subscription, payment failure, suspended company.

### 4. Employee Master And Profile Management
- Purpose: single source of truth for employee lifecycle.
- Features: employee CRUD, department, org chart, profile tabs, address, education, experience, dependents, bank, PF, salary revision, account stage, photo, exit details, change history.
- Inputs: employee id, email, name, job, department, manager, salary, statutory IDs, bank/PF data.
- Outputs: employee profile, directory, org chart, history records.
- Validations: unique email/employee id, required department/job/salary, role scope, file constraints.
- Dependencies: Department, User, Payroll, Documents, Leave, Attendance.
- Failure scenarios: duplicate employee, missing mandatory fields, inactive employee still selectable, employee delete with payroll history.

### 5. Document Management
- Purpose: store and retrieve employee/candidate/claim documents securely.
- Features: upload, list, download, delete; resumes and receipts also use uploads.
- Inputs: multipart files, employee id, document type.
- Outputs: document metadata and authenticated downloads.
- Validations: file size, type, ownership/scope.
- Failure scenarios: unsupported file, large file, path traversal, unauthorized download, orphaned files.

### 6. Organization Structure
- Purpose: model departments, managers, org chart, branches, locations, legal entities.
- Features: departments, org chart, company entities, branches, work locations.
- Dependencies: Employee, Company, Platform.
- Failure scenarios: deleting department with employees, circular manager hierarchy, missing location timezone.

### 7. Attendance, Regularization, Shifts, Biometric
- Purpose: record work presence, late arrivals, shifts, regularizations, biometric sync.
- Features: check-in/out, today attendance, employee attendance, monthly report, manual mark, attendance settings, biometric sync, device push, regularization submit/action, shift types, shift assignments, check-in verification, shift audit logs.
- Inputs: employee id, date, check-in/out, location, IP, device punch, shift times, regularization corrections.
- Outputs: attendance record, work hours, late flags, reports.
- Validations: employee scope, duplicate punch, checkout after checkin, geofence/IP, payroll lock, shift constraints.
- Failure scenarios: duplicate punch, timezone drift, offline biometric payload, invalid date, manager outside team edits.

### 8. Leave Management
- Purpose: manage leave requests, balances, approvals, calendar.
- Features: my leaves, leave balance, all balances, calendar, create request, approve, reject, cancel.
- Inputs: employee id, leave type, date range, reason, manager remarks.
- Outputs: leave request status, balance changes, calendar entries.
- Validations: date chronology, sufficient balance, overlap, holiday/weekend treatment, approval role/scope.
- Failure scenarios: negative duration, insufficient balance, duplicate overlapping leave, cancellation after payroll, inactive manager.

### 9. Payroll, Payslip, Tax, Compliance
- Purpose: calculate salaries, deductions, statutory returns, payslips, tax projections.
- Features: salary structure, payroll settings, preflight, calculate salary, run payroll, review, approve, process, reject, reverse, reports, export, payslip PDF, bulk payslips, email payslip, TDS, declarations, previous employer income, Form 16, ECR, ESIC.
- Inputs: salary structure, month/year, attendance, leaves, OT, tax declarations, previous employer income.
- Outputs: payroll run, payroll records, payslips, exports, statutory files.
- Validations: locked periods, duplicate runs, missing salary/PAN/bank, statutory caps, reviewer/approver segregation.
- Failure scenarios: payroll processed twice, partial run failure, salary visible to unauthorized user, incorrect statutory slab.

### 10. Recruitment And Offer
- Purpose: applicant tracking from job creation to selection and offer.
- Features: jobs, public applications, applicant stages, interviews, feedback, offers, offer PDF.
- Inputs: job details, resume, applicant details, stage, interview panel, feedback, offer salary.
- Outputs: candidate pipeline, interview records, offer letter.
- Validations: closed job cannot receive applications, required resume fields, duplicate applicant.
- Failure scenarios: public rate limit, applicant moved to invalid stage, offer for rejected candidate.

### 11. Onboarding And Offboarding Checklists
- Purpose: ensure lifecycle tasks are completed before active employment or separation.
- Features: checklist templates, template tasks, instantiate for employee, update task, custom task, complete onboarding, complete offboarding.
- Inputs: template, task title/order, employee id, due date, remarks, status.
- Outputs: task list, onboarding/offboarding completion status.
- Validations: cannot complete unless all tasks done unless force flag.
- Failure scenarios: missing checklist, force completion without authorization, employee stage not updated.

### 12. Full And Final Settlement
- Purpose: calculate exit settlement.
- Features: calculate FNF, finalize settlement, leave encashment, notice recovery, gratuity/TDS recovery expectations.
- Inputs: employee id, exit date, notice days, recovery/encashment values.
- Outputs: final settlement record, employee separated status.
- Failure scenarios: active payroll conflict, incorrect leave encashment, finalize twice, missing exit details.

### 13. Projects, Tasks, Timesheets, Overtime, Utilization
- Purpose: manage projects, assigned tasks, daily hours, overtime, utilization.
- Features: project CRUD, resource allocation, project expenses, task CRUD, status updates, timesheet logging, daily/all/employee timesheet summaries, attendance generation from timesheets, overtime detection/approval/rejection, utilization dashboards.
- Inputs: project fields, task fields, employee hours, task id, date, project expenses.
- Outputs: task actual hours, overtime records, project metrics, utilization reports.
- Validations: employee can log only own authorized timesheet, task must belong to assignee, hours > 0 and <= 24, project scope.
- Failure scenarios: time on another employee task, duplicate daily task entry update, overtime threshold mismatch, manager sees outside projects.

### 14. Expenses And Travel Advances
- Purpose: employee reimbursement and finance approval.
- Features: create/update claim, receipt upload/download, manager approve, finance approve/pay, reject, travel advance create/approve/settle.
- Inputs: title, category, amount, description, receipt, remarks.
- Outputs: claim status, payment status, approval trail.
- Validations: positive amount, file controls, manager/finance role separation, own-claim access.
- Failure scenarios: employee finance-approves, negative amount, duplicate settlement, receipt unauthorized access.

### 15. Performance
- Purpose: KRA, appraisal, manager review, 360 feedback.
- Features: KRA CRUD, appraisal create, self evaluation, manager evaluation, feedback360.
- Inputs: KRA title/weightage, ratings, feedback, reviewer.
- Outputs: appraisal status, final rating, feedback history.
- Validations: rating range, employee scope, no self 360 if disallowed.
- Failure scenarios: manager evaluates non-report, duplicate appraisal cycle.

### 16. Assets
- Purpose: track company assets issued to employees.
- Features: list assets, create asset, assign, return.
- Inputs: asset tag, name, category, serial number, condition, employee id.
- Outputs: asset status and assignment.
- Validations: unique asset tag, active employee, return only assigned asset.
- Failure scenarios: duplicate asset tag, employee creates asset, return unassigned asset.

### 17. Learning
- Purpose: course catalog and enrollments.
- Features: list/create course, list enrollments, assign course, update progress/status.
- Inputs: course title/category/mandatory, employee id, due date, progress.
- Outputs: course list, enrollment status.
- Validations: progress 0-100, active employee/course.
- Failure scenarios: employee assigns unauthorized course, invalid progress.

### 18. Helpdesk
- Purpose: HR/IT/admin issue handling.
- Features: ticket list/create/update.
- Inputs: category, subject, description, priority, assignee, resolution.
- Outputs: ticket status and assignment.
- Validations: own tickets for employee, edit by helpdesk/admin/manager scope.
- Failure scenarios: employee broadcasts/updates unauthorized ticket.

### 19. Notifications And Announcements
- Purpose: system alerts, reminders, approval notifications.
- Features: list notifications, create notification, mark read.
- Inputs: employee id, title, message, type, action URL.
- Outputs: unread/read notification inbox.
- Validations: employee can read own, admin can broadcast.
- Failure scenarios: employee sends broadcast, stale action URL.

### 20. Reports, Analytics, Dashboard, Audit
- Purpose: operational and statutory visibility.
- Features: executive summary, dynamic employee query, statutory reports, payroll reports, analytics, dashboards, exports, audit logs.
- Inputs: report type, filters, columns, month/year, role.
- Outputs: dashboard metrics, XLSX/CSV/PDF exports, audit trail.
- Validations: allowed report fields, export permission, salary masking.
- Failure scenarios: injection in dynamic filters, unauthorized export, inaccurate aggregation.

### 21. Platform AI Helpers
- Purpose: assist audit/proof review, payroll compliance, attendance regularization, policy Q&A.
- Features: proof audit, payroll audit, attendance regularization, policy questions.
- Test as advisory functions; results must not bypass approval workflows.

---

## C. User Roles And Permissions Matrix

| Role | Core Access | Allowed Actions | Restricted Actions | Approval Permissions | Data Scope |
| --- | --- | --- | --- | --- | --- |
| Super Admin | All modules, platform admin | VIEW/CREATE/EDIT/DELETE/EXPORT | None except business locks | KYC, payroll, workflow, all approvals | Global/all tenants depending platform route |
| Admin | HR operations, payroll, reports, settings | Broad VIEW/CREATE/EDIT/EXPORT | Many DELETE defaults blocked | Payroll, leave, attendance, expenses, onboarding | Own tenant |
| HR | Employees, attendance, leave, recruitment, onboarding, performance, assets, learning | VIEW/CREATE/EDIT/EXPORT | Salary/payroll final approval unless granted | Leave, attendance, onboarding, appraisals | Own tenant, HR scope |
| Manager | Team, attendance, leave, projects, expenses, performance | VIEW team, CREATE project/task, EDIT approvals | DELETE mostly blocked, payroll hidden | Leave, regularization, overtime, expense manager approval, appraisals | Self plus reporting hierarchy |
| Employee | ESS: attendance, leave, payslip, expenses, performance, learning, helpdesk, projects view | CREATE leave/expense/timesheet/helpdesk, VIEW own | Employee master edit/delete, finance/payroll admin | Self evaluation only | Own records and assigned tasks |
| Recruiter | Recruitment, employees view, projects view | Job/applicant/interview/offer management | Payroll, finance, settings | Recruitment workflow only | Recruitment data |
| Onboarding | Checklists and employee onboarding | Checklist templates/tasks, onboarding completion | Payroll, finance, platform admin | Onboarding/offboarding task completion | Assigned lifecycle tasks |
| Accounts | Payroll, accounts, reports, employee view | Salary/payroll processing/export | Employee edit/delete | Payroll run preparation | Payroll data in tenant |
| Finance | Payroll, compliance, expenses, accounts, reports | Expense finance approval, payroll/compliance actions | Employee edits | Finance approval, travel advance approval | Financial records |
| Payroll Reviewer | Payroll review | VIEW/EDIT/EXPORT payroll | Final approval/process unless role grants | Review payroll run | Payroll records |
| Payroll Approver | Payroll approval | VIEW/EDIT/EXPORT payroll | Draft creation if not granted | Approve/reject payroll run | Payroll records |
| Sales | Platform companies/custom plans | Platform sales actions | Tenant HR modules | Custom pricing | Platform company records |

Security expectations:
- Every protected API must require authentication.
- Every module action must enforce RBAC server-side, not just sidebar hiding.
- Employee self-service must enforce ownership.
- Manager routes must enforce team hierarchy.
- Salary, bank, statutory, document, and payroll data require stricter visibility.
- KYC/subscription gates must block tenant modules consistently.

---

## D. End-To-End Business Workflows

### 1. New Employee Onboarding
- Trigger: HR creates employee or candidate is converted.
- Actors: HR/Admin, Onboarding, Manager, Employee.
- Flow: create employee -> create user credentials -> instantiate onboarding checklist -> assign manager/department/shift -> upload documents -> complete tasks -> activate account stage -> employee login.
- Alternative: candidate selected from recruitment -> offer accepted -> employee profile prefilled.
- Exception: duplicate email/employee id, missing department, checklist incomplete, KYC/subscription blocked.
- Validations: mandatory profile fields, unique identifiers, active manager, permissions.
- Notifications: credentials, onboarding tasks, manager alert.
- Outcome: active employee with profile, user, checklist, documents.

### 2. Employee Login And Profile Update
- Trigger: employee receives credentials.
- Flow: login -> MFA if enabled -> dashboard -> profile view/update request -> HR/manager validates sensitive changes -> audit change.
- Alternative: password reset by admin.
- Exception: inactive account, expired subscription, pending KYC, MFA failure.
- Outcome: updated profile or rejected change.

### 3. Attendance Marking
- Trigger: employee starts workday.
- Flow: check-in with geo/IP -> system applies shift/grace -> check-out -> work hours calculated -> late/half-day/present status reflected.
- Alternative: biometric sync or manual HR marking.
- Exception: duplicate punch, out-of-geofence, checkout before checkin, payroll locked date.
- Outcome: attendance record available for payroll.

### 4. Leave Application And Approval
- Trigger: employee submits leave.
- Flow: select leave type/date/reason -> validate balance/overlap/date range -> request pending -> manager approves/rejects -> balance updates -> calendar and attendance reflect leave.
- Alternative: HR/admin approval, employee cancellation before approval.
- Exception: insufficient balance, date range invalid, inactive manager, payroll already processed.
- Outcome: approved leave and adjusted leave quota.

### 5. Payroll Processing
- Trigger: payroll cycle close.
- Flow: preflight -> verify employee salary/bank/PAN/attendance/leave/OT -> run payroll draft -> reviewer reviews -> approver approves -> process payroll -> payslips generated/emailed -> statutory exports.
- Alternative: reject/reverse run with reason.
- Exception: duplicate run, missing salary, locked period, partial failure, statutory data missing.
- Outcome: approved payroll records and payslips.

### 6. Recruitment To Employee Conversion
- Trigger: job vacancy approved.
- Flow: recruiter creates job -> applicant applies/uploads resume -> stage updates -> interview scheduled -> feedback submitted -> selected -> offer generated -> candidate accepts -> employee created -> onboarding starts.
- Exception: closed job application, duplicate candidate, invalid stage transition, rejected candidate offer.
- Outcome: employee profile and onboarding checklist.

### 7. Performance Review Cycle
- Trigger: appraisal cycle opened.
- Flow: HR/manager creates appraisal -> employee self-evaluation -> manager evaluation -> final rating -> reports.
- Alternative: 360 feedback submitted.
- Exception: invalid rating, wrong manager, duplicate cycle.
- Outcome: completed appraisal.

### 8. Asset Assignment And Return
- Trigger: employee joins or role requires equipment.
- Flow: admin creates asset -> assigns to employee -> employee asset visible -> return on transfer/exit -> condition recorded.
- Exception: duplicate tag, assign inactive asset, return asset not assigned.
- Outcome: asset inventory updated.

### 9. Expense Claim Approval
- Trigger: employee incurs reimbursable expense.
- Flow: submit claim with receipt -> manager approve/reject -> finance approve/pay/reject -> claim status updated.
- Alternative: travel advance requested -> finance approves -> settlement recorded.
- Exception: negative amount, missing receipt, unauthorized approval, duplicate settlement.
- Outcome: paid/rejected claim with approval trail.

### 10. Resignation And Offboarding
- Trigger: resignation/termination.
- Flow: HR records exit -> offboarding checklist instantiated -> assets returned -> documents complete -> FNF calculated -> payroll/admin finalizes -> employee separated.
- Exception: active asset, pending checklist, payroll locked, finalize twice.
- Outcome: separated employee and FNF settlement.

### 11. Document Upload And Verification
- Trigger: employee/HR uploads document.
- Flow: select employee -> upload file -> metadata stored -> HR verifies -> status visible.
- Exception: invalid file, large file, unauthorized download.
- Outcome: verified/rejected document.

### 12. Role And Permission Assignment
- Trigger: admin changes role/user permissions.
- Flow: open permissions -> update role/user -> affected user logs in -> sidebar and APIs reflect access -> unauthorized attempts blocked.
- Exception: non-superadmin modifies restricted role, stale token, explicit deny.
- Outcome: auditable permission change.

---

## E. Business Rules And Validations

- Employee email and employee code must be unique.
- Inactive employees must not appear for new task/shift/course/asset assignment unless explicitly allowed.
- Manager visibility is self plus reporting hierarchy.
- Employee visibility is own record only, except assigned projects/tasks.
- Leave end date must be on or after start date.
- Leave cannot overlap approved/pending leave for same employee.
- Leave approval must reduce balance according to leave type rules.
- Holiday/weekend rules must not over-deduct leave unless configured.
- Attendance check-out must be after check-in.
- Attendance duplicate punch must update or reject based on policy.
- Payroll-locked dates must block attendance/leave edits affecting salary.
- Payroll can run only once per month/year unless reversed.
- Payroll preflight must catch missing salary, bank, PAN, PF/ESIC, attendance anomalies.
- Overtime is generated when daily hours exceed shift standard hours.
- Task actual hours equal sum of approved/logged timesheet rows.
- Timesheet hours must be > 0 and <= 24.
- Employees cannot log time to tasks assigned to others.
- Expense amount must be positive.
- Finance approval and manager approval must be role separated.
- Asset tag must be unique.
- File uploads must validate size/type and require authorization to download.
- KYC pending/rejected tenants are restricted to allowed modules only.
- Expired subscription blocks protected tenant features except billing/KYC as designed.
- Reports export requires EXPORT permission.
- Salary data must be masked for unauthorized dashboard/report consumers.

---

## F. Integration Map

| Integration | Input | Output | Failure Handling | Retry | Security | Logging |
| --- | --- | --- | --- | --- | --- | --- |
| Email/Nodemailer | payslip, credential, notification payload | sent email/message id | queue failure, SMTP timeout | retry with backoff | no secrets in body logs | email event/audit |
| SMS/WhatsApp | phone, template, params | delivery status | provider unavailable | retry and dead-letter | signed webhook | message log |
| Biometric | device id, employee code, punch time | attendance sync result | invalid employee/device/time drift | batch retry | device token/IP allowlist | raw payload and sync result |
| Payroll bank file | payroll records, bank details | payment file | missing IFSC/account | regenerate after correction | encrypted export | export audit |
| Accounting | approved payroll/expenses | journal entries | API reject, duplicate voucher | idempotency key | OAuth/API key vault | integration log |
| Calendar | leave/interview/holiday | calendar event | auth expired | token refresh | OAuth scopes | event id log |
| Job portals | job/applicant data | applications/resumes | duplicate applicant, API down | polling retry | signed API | applicant import audit |
| Document storage | file stream + metadata | object key/url | upload fail | multipart retry | private bucket, signed URL | object audit |
| SSO/OAuth/LDAP | identity token | user session/profile | claim mismatch | login retry | issuer/audience validation | auth log |
| Payment gateway | plan/transaction | subscription status | failed payment/webhook miss | webhook replay | signature verification | payment transaction log |

---

## G. Test Data Requirements

- Tenants: approved company, pending KYC company, rejected KYC company, expired subscription company, suspended company.
- Roles: one active user for every role; one inactive user; users with explicit permission deny and custom permission grant.
- Employees: active, inactive, probation, full-time, contract, manager, no manager, joined mid-month, exit in progress, separated.
- Departments: Engineering, HR, Finance, Operations; at least one department with no employees.
- Locations: India timezone, non-India timezone; branch/location with holidays.
- Shifts: day shift, night shift, flexible shift, weekend off, women night shift requiring safety confirmation.
- Attendance: present, absent, late, half-day, leave day, holiday, weekend, manual correction, biometric punch.
- Leave: positive balances, zero balance, negative edge, overlapping request, pending request, approved request.
- Payroll: multiple salary structures, PF/ESIC eligible/ineligible, PT state variants, overtime, unpaid leave, tax declarations.
- Recruitment: open job, closed job, applicant in each stage, offer issued.
- Projects: active/on-hold/completed project, manager-owned project, employee assigned task, unassigned task.
- Expenses: small claim, high-value claim, claim with receipt, rejected claim, travel advance.
- Assets: available, assigned, returned, damaged.
- Documents: valid PDF/image, unsupported file, oversized file.
- Reports: data for each month/department/location/status.

---

## H. Complete E2E Test Strategy

### Test Levels
- Smoke: login, dashboard, employee list, attendance punch, leave create, payroll preflight, report view.
- Sanity: recent change areas such as timesheets/projects, RBAC, payroll, KYC gating.
- Functional: module-level positive/negative coverage.
- Regression: critical lifecycle flows plus prior production defects.
- Integration: email, biometric, payment, exports, storage, calendar/job portal mocks.
- API: all route auth, validation, response schema, status codes.
- UI: role navigation, forms, tables, filters, uploads, responsive behavior.
- Database: data integrity, uniqueness, soft delete, payroll locks, audit records.
- Security: auth, RBAC, IDOR/BOLA, injection, file security, sensitive data.
- Performance: bulk data, payroll, attendance sync, reports, dashboards.
- Backup/recovery: restore database and file storage consistency.

### Entry Criteria
- Stable QA build deployed.
- Seeded tenant and role test data.
- External services mocked or sandboxed.
- Test accounts and permissions documented.
- Known open defects triaged.

### Exit Criteria
- P0/P1 defects closed or waived.
- Smoke and critical E2E pass 100%.
- Regression pass >= 95% with no P0/P1 failures.
- Security P0/P1 tests pass.
- Payroll statutory sample calculations signed off.
- Performance benchmarks met for agreed scale.

---

## I. Module-Wise Test Scenarios

### AUTH-001
- Module: Authentication
- Feature: Login
- User Role: All
- Preconditions: active user exists.
- Test Steps: open login -> enter valid credentials -> submit.
- Test Data: employee/admin credentials.
- Expected Result: token/profile returned; dashboard visible; permissions loaded.
- Negative Test Cases: wrong password, inactive user, missing password.
- Edge Cases: MFA enabled, expired subscription tenant.
- Priority: P0
- Severity: Critical
- Automation Candidate: Yes

### AUTH-002
- Module: Authentication
- Feature: MFA verification
- User Role: All
- Preconditions: MFA enabled.
- Test Steps: login -> enter valid MFA -> access dashboard.
- Test Data: TOTP/recovery code.
- Expected Result: access granted only after MFA.
- Negative Test Cases: invalid code, replayed recovery code.
- Edge Cases: clock skew.
- Priority: P0
- Severity: Critical
- Automation Candidate: API yes, UI partial.

### RBAC-001
- Module: RBAC
- Feature: Unauthorized access prevention
- User Role: Employee
- Preconditions: employee token.
- Test Steps: call admin/payroll edit APIs and visit restricted pages.
- Test Data: employee token.
- Expected Result: 403/API denial; sidebar hidden.
- Negative Test Cases: direct URL/API attempt.
- Edge Cases: stale token after permission change.
- Priority: P0
- Severity: Critical
- Automation Candidate: Yes

### EMP-001
- Module: Employee
- Feature: Create employee
- User Role: HR/Admin
- Preconditions: department exists.
- Test Steps: create employee with mandatory fields.
- Test Data: unique email, employee code, job, salary.
- Expected Result: employee created and visible in directory.
- Negative Test Cases: duplicate email, missing department.
- Edge Cases: future joining date, probation status.
- Priority: P0
- Severity: High
- Automation Candidate: Yes

### EMP-002
- Module: Employee
- Feature: Update statutory/bank details
- User Role: HR/Admin
- Preconditions: employee exists.
- Test Steps: edit PAN/PF/bank fields -> save -> reload.
- Expected Result: data persists; audit/change history created where applicable.
- Negative Test Cases: invalid account/IFSC formats if validation exists.
- Edge Cases: update after payroll processed.
- Priority: P1
- Severity: High
- Automation Candidate: Yes

### DOC-001
- Module: Documents
- Feature: Upload/download document
- User Role: HR/Admin
- Preconditions: employee exists.
- Test Steps: upload PDF -> list -> download.
- Expected Result: metadata stored and file downloads only with auth.
- Negative Test Cases: unsupported file, large file, unauthorized employee download.
- Edge Cases: deleted employee document access.
- Priority: P0
- Severity: High
- Automation Candidate: API yes.

### ATT-001
- Module: Attendance
- Feature: Check-in/check-out
- User Role: Employee
- Preconditions: active employee, shift assigned.
- Test Steps: check in -> check out.
- Expected Result: attendance record with work hours.
- Negative Test Cases: duplicate check-in, checkout without checkin.
- Edge Cases: night shift crosses midnight, timezone conversion.
- Priority: P0
- Severity: Critical
- Automation Candidate: Yes

### ATT-002
- Module: Attendance
- Feature: Biometric sync
- User Role: Admin
- Preconditions: biometric device exists.
- Test Steps: post bulk punches.
- Expected Result: valid punches create/update attendance; invalid rows reported.
- Negative Test Cases: unknown employee, duplicate payload.
- Edge Cases: device clock drift.
- Priority: P0
- Severity: Critical
- Automation Candidate: API yes.

### LEAVE-001
- Module: Leave
- Feature: Apply leave and approve
- User Role: Employee/Manager
- Preconditions: leave balance available, manager linked.
- Test Steps: employee applies -> manager approves.
- Expected Result: status APPROVED; balance reduced; calendar updated.
- Negative Test Cases: insufficient balance, end before start.
- Edge Cases: weekend/holiday in date range, half-day leave.
- Priority: P0
- Severity: Critical
- Automation Candidate: Yes

### SHIFT-001
- Module: Shifts
- Feature: Assign shift
- User Role: HR/Admin
- Preconditions: employee and shift type exist.
- Test Steps: assign shift date range.
- Expected Result: assignment visible; attendance uses shift rules.
- Negative Test Cases: invalid date range, duplicate overlapping shift.
- Edge Cases: women night shift without safety confirmation.
- Priority: P1
- Severity: High
- Automation Candidate: Yes

### PAY-001
- Module: Payroll
- Feature: Monthly payroll run
- User Role: Admin/Accounts
- Preconditions: salary structures, attendance, leave data complete.
- Test Steps: run preflight -> run payroll.
- Expected Result: payroll run and records created; net pay accurate.
- Negative Test Cases: duplicate run, missing salary/bank/PAN.
- Edge Cases: mid-month join/exit, LOP, overtime.
- Priority: P0
- Severity: Critical
- Automation Candidate: API yes.

### PAY-002
- Module: Payroll
- Feature: Review/approve/process
- User Role: Payroll Reviewer/Approver/Admin
- Preconditions: draft payroll exists.
- Test Steps: reviewer reviews -> approver approves -> admin processes.
- Expected Result: correct status transitions and audit.
- Negative Test Cases: approver reviews without role, process rejected run.
- Edge Cases: reversal after approval.
- Priority: P0
- Severity: Critical
- Automation Candidate: Yes

### TAX-001
- Module: Tax/Compliance
- Feature: Form 16/statutory reports
- User Role: Finance/Accounts/Admin
- Preconditions: payroll data exists.
- Test Steps: generate reports/export.
- Expected Result: statutory values match expected calculations.
- Negative Test Cases: unauthorized export.
- Edge Cases: PF/ESIC/PT threshold boundaries.
- Priority: P0
- Severity: Critical
- Automation Candidate: API/data-driven.

### REC-001
- Module: Recruitment
- Feature: Candidate pipeline
- User Role: Recruiter
- Preconditions: job opening exists.
- Test Steps: applicant applies -> stage update -> interview -> feedback -> offer.
- Expected Result: candidate status and offer generated.
- Negative Test Cases: apply to closed job, invalid stage transition.
- Edge Cases: duplicate applicant email.
- Priority: P1
- Severity: High
- Automation Candidate: Yes

### ONB-001
- Module: Onboarding
- Feature: Checklist completion
- User Role: Onboarding/HR
- Preconditions: template and employee exist.
- Test Steps: instantiate checklist -> complete tasks -> complete onboarding.
- Expected Result: employee stage active after tasks complete.
- Negative Test Cases: complete onboarding with pending tasks.
- Edge Cases: force completion.
- Priority: P1
- Severity: High
- Automation Candidate: Yes

### PROJ-001
- Module: Projects/Timesheets
- Feature: Task time logging
- User Role: Employee/Manager
- Preconditions: project and assigned task exist.
- Test Steps: employee logs hours against assigned task.
- Expected Result: timesheet created; task actual hours updated; overtime if threshold crossed.
- Negative Test Cases: log to another employee task, >24 hours.
- Edge Cases: same task/date update, project filter.
- Priority: P0
- Severity: High
- Automation Candidate: Yes

### EXP-001
- Module: Expenses
- Feature: Claim approval
- User Role: Employee/Manager/Finance
- Preconditions: employee and manager exist.
- Test Steps: submit claim -> manager approves -> finance approves.
- Expected Result: status progression and paid marker.
- Negative Test Cases: negative amount, employee finance approval.
- Edge Cases: receipt download authorization.
- Priority: P0
- Severity: High
- Automation Candidate: Yes

### PERF-001
- Module: Performance
- Feature: Appraisal cycle
- User Role: HR/Manager/Employee
- Preconditions: employee and manager exist.
- Test Steps: create appraisal -> self evaluation -> manager evaluation.
- Expected Result: final rating stored.
- Negative Test Cases: invalid rating, wrong manager.
- Edge Cases: duplicate appraisal period.
- Priority: P1
- Severity: Medium
- Automation Candidate: Yes

### ASSET-001
- Module: Assets
- Feature: Asset assignment/return
- User Role: HR/Admin
- Preconditions: available asset and employee exist.
- Test Steps: create asset -> assign -> return.
- Expected Result: status and assignment dates update.
- Negative Test Cases: duplicate tag, employee create asset.
- Edge Cases: damaged return.
- Priority: P1
- Severity: High
- Automation Candidate: Yes

### REPORT-001
- Module: Reports
- Feature: Export report
- User Role: Admin/HR/Finance
- Preconditions: report data exists.
- Test Steps: apply filters -> export.
- Expected Result: file downloads and data matches DB.
- Negative Test Cases: unauthorized export, invalid dynamic filter field.
- Edge Cases: large report generation.
- Priority: P0
- Severity: High
- Automation Candidate: API yes, UI smoke.

---

## J. Critical Production Test Cases

1. HR creates employee -> credentials issued -> employee logs in -> updates profile -> manager/HR validates -> audit record created.
2. Employee applies leave -> manager approves -> leave balance updates -> attendance calendar reflects leave -> payroll LOP unaffected for paid leave.
3. Employee marks attendance late -> late flag generated -> payroll preflight identifies attendance anomaly -> deduction applies if policy demands.
4. Recruiter creates job -> candidate applies -> interview scheduled -> feedback submitted -> offer generated -> selected candidate converted to employee.
5. Payroll admin runs payroll -> reviewer reviews -> approver approves -> payslip generated -> employee downloads only own payslip.
6. Employee resigns -> offboarding checklist starts -> assets returned -> FNF calculated -> settlement finalized -> employee separated.
7. Admin changes role permissions -> affected user logs in -> unauthorized API and UI access blocked.
8. Employee uploads document -> HR verifies -> status changes -> unauthorized user cannot download.
9. Shift assigned -> attendance rules applied -> timesheet hours generate overtime -> overtime approved -> payroll reflects OT.
10. Holiday configured -> attendance/leave/payroll/report modules treat holiday correctly.
11. Tenant with pending KYC attempts payroll -> blocked; attendance and leave remain allowed.
12. Subscription expires -> tenant protected modules blocked except billing/KYC recovery path.

---

## K. Negative And Edge Case Scenarios

- Invalid login attempts trigger rate limiting.
- Expired/invalid JWT cannot access APIs.
- MFA code replay fails.
- Employee tries another employee leave/payroll/document/expense APIs.
- Duplicate employee ID/email rejected.
- Required profile fields missing.
- Invalid date ranges for leave, shift, payroll, project.
- Leave beyond balance blocked or routed to unpaid leave per policy.
- Attendance outside allowed geo/IP rejected.
- Checkout before checkin rejected.
- Payroll run submitted twice for same month/year.
- Payroll processed while preflight has critical errors.
- Employee deleted/deactivated with active payroll/history.
- Manager inactive during approval; fallback approval path required.
- Attachment upload fails mid-request.
- Oversized or malicious upload blocked.
- Concurrent approval by two managers results in one final state.
- Concurrent payroll run requests are idempotent/locked.
- Incorrect permission assignment cannot grant Super Admin powers to normal admin unless allowed.
- Reports reject unsupported filter fields and injection payloads.
- Export attempts without EXPORT permission return 403.

---

## L. Security Test Cases

- AUTH-SEC-001: brute force login lock/rate limit.
- AUTH-SEC-002: token tampering returns 401.
- AUTH-SEC-003: inactive account returns 403.
- AUTH-SEC-004: MFA required token cannot access normal APIs.
- RBAC-SEC-001: employee cannot access admin endpoints by direct API.
- RBAC-SEC-002: manager cannot access non-report employee data.
- RBAC-SEC-003: salary/payroll hidden from unauthorized dashboards.
- API-SEC-001: all protected routes require auth.
- API-SEC-002: IDOR checks on employeeId, documentId, payslipId, claimId, taskId.
- FILE-SEC-001: uploaded executable/script rejected.
- FILE-SEC-002: path traversal filename blocked.
- XSS-SEC-001: names/descriptions containing script tags render safely.
- SQL-SEC-001: report filter/search injection rejected.
- CSRF-SEC-001: cookie-auth state-changing requests protected by SameSite/CSRF strategy.
- EXPORT-SEC-001: data exports require explicit EXPORT permission.
- AUDIT-SEC-001: sensitive changes write audit trails with actor/timestamp/action.
- PRIV-SEC-001: PAN/Aadhar/bank/salary data masked or restricted.

---

## M. Performance Test Scenarios

Benchmarks should be confirmed with product owners. Suggested release gates:
- Login/profile API p95 < 500 ms at 100 concurrent users.
- Dashboard p95 < 2 seconds for tenant with 5,000 employees.
- Employee directory search p95 < 1 second with 50,000 employees.
- Payroll preflight for 5,000 employees < 2 minutes.
- Payroll run for 5,000 employees < 5 minutes and no partial records on failure.
- Biometric sync 100,000 punches < 10 minutes with error report.
- Report export 100,000 rows < 2 minutes or async job.
- Leave approval API p95 < 700 ms during 200 concurrent approvals.
- File upload 10 MB succeeds within agreed timeout.
- Mobile/responsive pages interactive under 3 seconds on mid-tier devices.

Scenarios:
- 500 concurrent logins.
- 1,000 employees checking in within 10 minutes.
- Bulk biometric payload with duplicates and invalid rows.
- Payroll for multiple tenants in parallel.
- Large attendance/payroll/report exports.
- Dashboard under high data volume.

---

## N. Reports Testing Checklist

| Report | Filters | Exports | Permissions | Accuracy Checks |
| --- | --- | --- | --- | --- |
| Employee Master | department, status, location, join date | XLSX/CSV/PDF | EMPLOYEES.VIEW/EXPORT | count matches active/inactive employees |
| Attendance | month, employee, department, status | XLSX/CSV | ATTENDANCE.VIEW/EXPORT | present/absent/late/work hours vs attendance table |
| Leave | type, status, date range, employee | XLSX/CSV | LEAVE.VIEW/EXPORT | approved days and balances |
| Payroll | month/year, employee, department | XLSX/PDF | PAYROLL.VIEW/EXPORT | gross/deductions/net pay totals |
| Tax | year, employee | PDF/XLSX | PAYROLL/COMPLIANCE | TDS and declaration calculations |
| Statutory PF/ESIC/PT | period, legal entity, state | XLSX/TXT/PDF | COMPLIANCE.EXPORT | statutory caps and thresholds |
| Headcount | department/location/status | dashboard/export | REPORTS.VIEW | counts by department and gender |
| Attrition | period, department | dashboard/export | REPORTS.VIEW | exit counts and rate formula |
| Performance | cycle, department, rating | XLSX | PERFORMANCE.VIEW | rating distribution |
| Asset | status, employee, category | XLSX | ASSETS.VIEW | assigned/available counts |
| Expense | status, category, period | XLSX | EXPENSES.VIEW | claim totals by status |
| Audit Log | actor, action, entity, date | XLSX | SETTINGS/REPORTS | immutable audit trail |

Validation:
- Filter chips match query.
- Empty state is clear.
- Export file opens and row count matches UI.
- Restricted users cannot export.
- Currency/date formats match tenant locale.

---

## O. Automation Testing Scope

### UI Automation
- Login/MFA happy path.
- Role-based sidebar visibility.
- Employee create/update.
- Attendance check-in/out.
- Leave apply/approve.
- Project/task/timesheet flow.
- Expense claim and approval.
- Payroll smoke: preflight/run/review/approve where data allows.
- Payslip download smoke.
- Report export smoke.

### API Automation
- All auth/RBAC/IDOR tests.
- Employee CRUD and duplicate validation.
- Attendance, shift, biometric sync.
- Leave balance and approvals.
- Payroll calculation data-driven cases.
- Statutory boundary calculations.
- Projects/timesheets/overtime rollups.
- Expense approval transitions.
- Recruitment pipeline.
- KYC/subscription gating.
- Reports filter/export authorization.

### CI/CD
- PR: lint/build, API smoke, RBAC/security smoke.
- Nightly: full API regression, UI critical flows, data-driven payroll/statutory.
- Pre-release: full E2E, security suite, performance smoke, backup/restore drill.
- Post-deploy: production smoke with synthetic tenant and non-sensitive data.

---

## P. Risk-Based Testing Recommendations

Highest risk areas:
1. Payroll calculations and statutory compliance.
2. Leave/attendance inputs that affect payroll.
3. RBAC, IDOR, and salary/document privacy.
4. KYC/subscription tenant gating.
5. Approval workflows and concurrent state changes.
6. Report/export accuracy and authorization.
7. File upload/download security.
8. Biometric sync and timezone handling.
9. Employee lifecycle transitions: onboarding, active, exit, separated.
10. Data imports/exports and integrations.

Recommended focus:
- Automate P0 API and RBAC tests first.
- Build golden payroll datasets with expected values.
- Use data-driven statutory boundary cases.
- Add concurrency tests for payroll, leave approvals, expense approvals.
- Add explicit audit-log assertions for sensitive changes.
- Run browser/mobile responsive smoke before every release.

---

## Q. Production Release Readiness Checklist

### Functional
- [ ] All critical E2E flows pass.
- [ ] Payroll calculations reconciled with finance-approved samples.
- [ ] Leave, attendance, overtime, and payroll integration validated.
- [ ] Recruitment-to-onboarding-to-employee flow validated.
- [ ] Exit/FNF flow validated.
- [ ] Reports match database source totals.

### Security
- [ ] All protected APIs require authentication.
- [ ] RBAC and IDOR tests pass for every sensitive entity.
- [ ] Salary, statutory, bank, and document data restricted.
- [ ] Upload validation and download authorization pass.
- [ ] Security headers and cookie settings verified.
- [ ] Audit logs exist for sensitive writes.

### Data And Integrations
- [ ] Seed/test data documented and repeatable.
- [ ] Email/SMS/payment/biometric integrations sandbox-tested.
- [ ] Retry/error logging validated.
- [ ] Backups and restore tested.
- [ ] File storage restore reconciles with database metadata.

### Performance
- [ ] Payroll large-volume benchmark met.
- [ ] Attendance sync benchmark met.
- [ ] Dashboard/report benchmark met.
- [ ] Concurrent login/approval benchmark met.

### Operations
- [ ] Environment variables documented.
- [ ] Monitoring/health checks enabled.
- [ ] Release rollback plan documented.
- [ ] Known defects triaged and signed off.
- [ ] UAT signoff from HR, payroll, finance, and admin stakeholders.

---

## R. Production-Like Test Data Pack

This section defines realistic sample data that QA can use for manual testing, API automation, Playwright UI flows, payroll golden-data validation, and UAT demos. Use these values as seed data or as a reference when creating test fixtures. Passwords below are placeholders for non-production environments only.

### 1. Tenant And Company Data

| Tenant ID | Company Name | CIN | KYC Status | Subscription | Plan | Expected Access |
| --- | --- | --- | --- | --- | --- | --- |
| TEN-APPROVED-001 | PID hcms Technologies Pvt Ltd | U72200KA2020PTC123456 | APPROVED | ACTIVE | Professional | Full tenant access |
| TEN-PENDING-001 | BrightWave Consulting Pvt Ltd | U74999MH2022PTC987654 | PENDING | TRIAL_ACTIVE | Starter | Attendance and Leave only |
| TEN-REJECTED-001 | UrbanLeaf Retail Pvt Ltd | U52100DL2021PTC456789 | REJECTED | TRIAL_ACTIVE | Starter | Restricted, KYC correction required |
| TEN-EXPIRED-001 | Apex Payroll Services Pvt Ltd | U93000TN2019PTC334455 | APPROVED | EXPIRED | Professional | Billing/KYC recovery only |
| TEN-SUSPENDED-001 | Zenith Field Ops Pvt Ltd | U74900TG2023PTC556677 | APPROVED | ACTIVE | Enterprise | Blocked due to company suspension |

### 2. User Accounts And Role Coverage

| User Code | Role | Email | Password | Linked Employee | Primary Purpose |
| --- | --- | --- | --- | --- | --- |
| USR-SA-001 | SUPER_ADMIN | superadmin@pid-hcms.test | Test@12345 | None | Platform admin, KYC, all permissions |
| USR-ADMIN-001 | ADMIN | admin@pid-hcms.test | Test@12345 | EMP-HR-001 | Tenant admin, payroll run, settings |
| USR-HR-001 | HR | hr.manager@pid-hcms.test | Test@12345 | EMP-HR-001 | Employee master, leave/attendance exceptions |
| USR-MGR-001 | MANAGER | ananya.rao@pid-hcms.test | Test@12345 | EMP-MGR-001 | Team approvals, project management |
| USR-EMP-001 | EMPLOYEE | rajesh.kumar@pid-hcms.test | Test@12345 | EMP-ENG-001 | ESS happy path |
| USR-EMP-002 | EMPLOYEE | priya.sharma@pid-hcms.test | Test@12345 | EMP-ENG-002 | Leave/attendance edge cases |
| USR-REC-001 | RECRUITER | recruiter@pid-hcms.test | Test@12345 | EMP-HR-002 | Recruitment pipeline |
| USR-ONB-001 | ONBOARDING | onboarding@pid-hcms.test | Test@12345 | EMP-HR-003 | Checklist workflows |
| USR-ACC-001 | ACCOUNTS | accounts@pid-hcms.test | Test@12345 | EMP-FIN-001 | Payroll preparation |
| USR-FIN-001 | FINANCE | finance@pid-hcms.test | Test@12345 | EMP-FIN-002 | Expense finance approval |
| USR-REV-001 | PAYROLL_REVIEWER | payroll.reviewer@pid-hcms.test | Test@12345 | EMP-FIN-003 | Payroll review |
| USR-APR-001 | PAYROLL_APPROVER | payroll.approver@pid-hcms.test | Test@12345 | EMP-FIN-004 | Payroll approval |
| USR-SALES-001 | SALES | sales@pid-hcms.test | Test@12345 | None | Custom plan assignment |
| USR-INACTIVE-001 | EMPLOYEE | inactive.employee@pid-hcms.test | Test@12345 | EMP-INACTIVE-001 | Inactive account denial |

### 3. Organization Structure

| Department | Designation Examples | Manager | Location | Notes |
| --- | --- | --- | --- | --- |
| Engineering | Engineering Lead, Senior Developer, QA Engineer | EMP-MGR-001 | Bangalore | Project and timesheet scenarios |
| Human Resources | HR Manager, Recruiter, Onboarding Specialist | EMP-HR-001 | Hyderabad | Employee lifecycle scenarios |
| Finance | Accounts Officer, Finance Officer, Payroll Reviewer | EMP-FIN-001 | Bangalore | Payroll and expenses |
| Operations | Shift Coordinator, Field Executive | EMP-OPS-001 | Hyderabad | Shifts and biometric attendance |
| Sales | Sales Executive, Sales Manager | EMP-SALES-001 | Mumbai | Travel advance and field attendance |

### 4. Employee Master Data

| Employee ID | Name | Role/Job | Dept | Manager | Employment Type | Join Date | Salary | Status | Test Purpose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EMP-HR-001 | Meera Nair | HR Manager | HR | None | FULL_TIME | 2021-04-01 | 140000 | ACTIVE | HR/admin workflows |
| EMP-MGR-001 | Ananya Rao | Engineering Lead | Engineering | EMP-HR-001 | FULL_TIME | 2020-07-15 | 180000 | ACTIVE | Manager approvals |
| EMP-ENG-001 | Rajesh Kumar | Senior Developer | Engineering | EMP-MGR-001 | FULL_TIME | 2022-01-10 | 95000 | ACTIVE | ESS happy path |
| EMP-ENG-002 | Priya Sharma | QA Engineer | Engineering | EMP-MGR-001 | FULL_TIME | 2023-03-20 | 72000 | ACTIVE | Leave/attendance edge cases |
| EMP-ENG-003 | Arjun Menon | Developer - Probation | Engineering | EMP-MGR-001 | PROBATION | 2026-06-01 | 55000 | ACTIVE | Mid-month join payroll |
| EMP-FIN-001 | Kavita Iyer | Accounts Officer | Finance | EMP-HR-001 | FULL_TIME | 2021-08-01 | 105000 | ACTIVE | Payroll processing |
| EMP-FIN-002 | Nikhil Shah | Finance Officer | Finance | EMP-FIN-001 | FULL_TIME | 2021-09-12 | 110000 | ACTIVE | Expense final approval |
| EMP-FIN-003 | Farah Khan | Payroll Reviewer | Finance | EMP-FIN-001 | FULL_TIME | 2020-11-05 | 125000 | ACTIVE | Payroll review |
| EMP-FIN-004 | Vivek Reddy | Payroll Approver | Finance | EMP-FIN-001 | FULL_TIME | 2019-02-18 | 160000 | ACTIVE | Payroll approval |
| EMP-OPS-001 | Suresh Patil | Shift Coordinator | Operations | EMP-HR-001 | FULL_TIME | 2022-05-09 | 65000 | ACTIVE | Shift management |
| EMP-OPS-002 | Neha Verma | Field Executive | Operations | EMP-OPS-001 | CONTRACT | 2024-10-01 | 38000 | ACTIVE | Contract employee rules |
| EMP-EXIT-001 | Rohan Das | Support Engineer | Operations | EMP-OPS-001 | FULL_TIME | 2020-01-10 | 70000 | EXIT_IN_PROGRESS | FNF and offboarding |
| EMP-INACTIVE-001 | Amit Bose | Former Analyst | Finance | EMP-FIN-001 | FULL_TIME | 2018-05-15 | 60000 | INACTIVE | Access denial |

### 5. Salary And Statutory Golden Data

| Employee ID | Basic | HRA | DA | Special Allowance | PF Eligible | ESIC Eligible | PT State | Expected Scenario |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| EMP-ENG-001 | 45000 | 18000 | 5000 | 27000 | Yes | No | Karnataka | Normal payroll with PF cap checks |
| EMP-ENG-002 | 30000 | 12000 | 3000 | 27000 | Yes | No | Karnataka | Paid leave plus attendance deductions |
| EMP-ENG-003 | 24000 | 9600 | 2000 | 19400 | Yes | No | Karnataka | Mid-month joining prorated salary |
| EMP-OPS-002 | 15000 | 6000 | 1000 | 16000 | Yes | No | Telangana | Contract employee payroll |
| EMP-FIN-001 | 50000 | 20000 | 5000 | 30000 | Yes | No | Tamil Nadu | PT semi-annual boundary validation |
| EMP-EXIT-001 | 32000 | 12800 | 3000 | 22200 | Yes | No | Maharashtra | FNF, notice recovery, leave encashment |

Payroll test months:
- May 2026: normal completed payroll baseline.
- June 2026: active test month with leave, late attendance, overtime, and mid-month join.
- July 2026: future month for duplicate and preflight validations.

### 6. Leave Balance And Leave Requests

| Employee ID | Casual Leave | Sick Leave | Earned Leave | Comp Off | Scenario |
| --- | ---: | ---: | ---: | ---: | --- |
| EMP-ENG-001 | 6 | 5 | 12 | 1 | Happy path leave approval |
| EMP-ENG-002 | 0 | 1 | 2 | 0 | Insufficient casual leave |
| EMP-ENG-003 | 1 | 1 | 0 | 0 | Probation leave limits |
| EMP-EXIT-001 | 3 | 4 | 18 | 0 | Exit leave encashment |

Sample leave requests:
- LR-001: EMP-ENG-001, Casual Leave, 2026-06-22 to 2026-06-23, PENDING, manager EMP-MGR-001.
- LR-002: EMP-ENG-002, Sick Leave, 2026-06-18 to 2026-06-18, APPROVED.
- LR-003: EMP-ENG-002, Casual Leave, 2026-06-25 to 2026-06-27, expected insufficient balance failure.
- LR-004: EMP-ENG-001, Earned Leave, 2026-06-28 to 2026-06-26, expected invalid date range failure.

### 7. Attendance, Shifts, Holidays, And Biometric Data

Shift types:

| Shift Code | Name | Start | End | Min Hours | Grace | Weekly Off | Notes |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| SHIFT-DAY | General Day | 09:30 | 18:30 | 8 | 15 minutes | Sat/Sun | Default office shift |
| SHIFT-FLEX | Flexible | 10:00 | 19:00 | 8 | 30 minutes | Sat/Sun | Flex attendance |
| SHIFT-NIGHT | Night Operations | 21:00 | 06:00 | 8 | 15 minutes | Sun | Cross-midnight testing |

Attendance samples:

| Employee ID | Date | Check In | Check Out | Expected Status | Scenario |
| --- | --- | --- | --- | --- | --- |
| EMP-ENG-001 | 2026-06-15 | 09:25 | 18:35 | PRESENT | Normal day |
| EMP-ENG-001 | 2026-06-16 | 10:05 | 18:30 | LATE/PRESENT | Late beyond grace |
| EMP-ENG-002 | 2026-06-16 | 09:45 | 13:30 | HALF_DAY | Short hours |
| EMP-ENG-002 | 2026-06-17 | None | None | ABSENT | No punch |
| EMP-OPS-002 | 2026-06-18 | 21:00 | 06:20 next day | PRESENT | Night shift |
| EMP-ENG-001 | 2026-06-19 | 09:30 | 21:30 | OVERTIME | 12 hours worked |

Holidays:
- 2026-01-26 Republic Day.
- 2026-08-15 Independence Day.
- 2026-10-02 Gandhi Jayanti.
- 2026-12-25 Christmas.
- Add tenant-specific local holiday: 2026-06-27 Company Foundation Day.

Biometric device data:
- Device ID: BIO-BLR-001, Location: Bangalore Office, IP: 192.168.10.20.
- Device ID: BIO-HYD-001, Location: Hyderabad Office, IP: 192.168.20.20.
- Invalid punch sample: employeeCode `EMP99999`, timestamp `2026-06-16T09:30:00+05:30`, expected rejected row.

### 8. Project, Task, Timesheet, And Overtime Data

| Project Code | Name | Manager | Status | Budget | Resources |
| --- | --- | --- | --- | ---: | --- |
| PRJ-HRMS-001 | HRMS Payroll Modernization | EMP-MGR-001 | ACTIVE | 2500000 | EMP-ENG-001, EMP-ENG-002 |
| PRJ-MOB-001 | Mobile ESS Rollout | EMP-MGR-001 | PLANNING | 1200000 | EMP-ENG-003 |
| PRJ-OPS-001 | Biometric Device Integration | EMP-OPS-001 | ACTIVE | 900000 | EMP-OPS-002, EMP-ENG-002 |

Tasks:

| Task Code | Project | Title | Assignee | Estimated Hours | Status |
| --- | --- | --- | --- | ---: | --- |
| TSK-001 | PRJ-HRMS-001 | Payroll variance report API | EMP-ENG-001 | 16 | IN_PROGRESS |
| TSK-002 | PRJ-HRMS-001 | Leave balance regression suite | EMP-ENG-002 | 12 | TODO |
| TSK-003 | PRJ-MOB-001 | Flutter payslip screen QA | EMP-ENG-003 | 10 | TODO |
| TSK-004 | PRJ-OPS-001 | Biometric sync retry tests | EMP-OPS-002 | 20 | IN_PROGRESS |

Timesheets:
- TS-001: EMP-ENG-001, TSK-001, 2026-06-15, 8 hours, expected task actual hours +8.
- TS-002: EMP-ENG-001, TSK-001, 2026-06-19, 12 hours, expected overtime 4 hours if standard is 8.
- TS-NEG-001: EMP-ENG-001 tries TSK-002, expected rejection because task belongs to EMP-ENG-002.
- TS-NEG-002: EMP-ENG-001 logs 25 hours, expected validation failure.

### 9. Recruitment Pipeline Data

| Job Code | Title | Department | Status | Hiring Manager | Openings |
| --- | --- | --- | --- | --- | ---: |
| JOB-ENG-001 | Senior Backend Engineer | Engineering | OPEN | EMP-MGR-001 | 2 |
| JOB-QA-001 | QA Automation Engineer | Engineering | OPEN | EMP-MGR-001 | 1 |
| JOB-HR-001 | HR Operations Executive | HR | CLOSED | EMP-HR-001 | 1 |

Candidates:

| Candidate Code | Name | Email | Job | Stage | Expected Use |
| --- | --- | --- | --- | --- | --- |
| CAND-001 | Isha Mehta | isha.mehta@example.test | JOB-ENG-001 | APPLIED | Pipeline happy path |
| CAND-002 | Mohit Saini | mohit.saini@example.test | JOB-QA-001 | INTERVIEW | Feedback and selection |
| CAND-003 | Tara Joseph | tara.joseph@example.test | JOB-HR-001 | REJECTED | Closed job/invalid offer negative |

Interview:
- INT-001: CAND-002, Panel EMP-MGR-001 and EMP-HR-001, 2026-06-24 11:00, expected feedback submission.

Offer:
- OFFER-001: CAND-002, CTC 900000, joining date 2026-07-15, expected conversion to employee after acceptance.

### 10. Expense And Travel Advance Data

| Claim Code | Employee | Category | Amount | Status | Scenario |
| --- | --- | --- | ---: | --- | --- |
| EXP-001 | EMP-ENG-001 | TRAVEL | 1250 | PENDING | Manager approval happy path |
| EXP-002 | EMP-ENG-002 | MEALS | 850 | MANAGER_APPROVED | Finance approval |
| EXP-003 | EMP-SALES-001 | LODGING | 6200 | FINANCE_APPROVED | Paid marker validation |
| EXP-NEG-001 | EMP-ENG-001 | TRAVEL | -500 | N/A | Negative amount rejection |

Travel advances:
- ADV-001: EMP-SALES-001, client visit to Pune, requested 15000, finance approves 12000.
- ADV-002: EMP-OPS-002, field installation, requested 8000, rejected due to missing purpose details.

### 11. Asset, Learning, Helpdesk, Notification Data

Assets:

| Asset Tag | Name | Category | Status | Assigned To | Scenario |
| --- | --- | --- | --- | --- | --- |
| AST-LAP-001 | Dell Latitude 7440 | Laptop | ASSIGNED | EMP-ENG-001 | Return during exit/transfer |
| AST-MOB-001 | iPhone 15 | Mobile | AVAILABLE | None | Assignment happy path |
| AST-ID-001 | Access Card 1001 | ID_CARD | ASSIGNED | EMP-OPS-002 | Field employee asset |

Learning:
- CRS-001: POSH Compliance 2026, mandatory, assigned to all active employees.
- CRS-002: Secure Payroll Handling, mandatory for Finance and Payroll roles.
- ENR-001: EMP-ENG-001 in CRS-001, progress 40, expected update to 100.

Helpdesk:
- HD-001: EMP-ENG-001, IT, Laptop VPN not connecting, HIGH, OPEN.
- HD-002: EMP-ENG-002, HR, Leave balance mismatch, MEDIUM, IN_PROGRESS.

Notifications:
- NOT-001: Payroll processed for May 2026, target all active employees.
- NOT-002: Leave request pending approval, target EMP-MGR-001.
- NOT-003: KYC rejected, target tenant admin of TEN-REJECTED-001.

### 12. Document Upload Data

| Document Code | Owner | Type | File Name | Expected Result |
| --- | --- | --- | --- | --- |
| DOC-001 | EMP-ENG-001 | PAN | pan-rajesh.pdf | Accepted and downloadable by HR/admin |
| DOC-002 | EMP-ENG-001 | ADDRESS_PROOF | address-rajesh.jpg | Accepted |
| DOC-003 | CAND-001 | RESUME | isha-resume.pdf | Candidate resume accepted |
| DOC-NEG-001 | EMP-ENG-001 | SCRIPT | malicious.html | Rejected |
| DOC-NEG-002 | EMP-ENG-001 | LARGE_FILE | large-25mb.pdf | Rejected if above limit |

### 13. Approval Hierarchy Data

| Process | Requester | First Approver | Final Approver | Negative Case |
| --- | --- | --- | --- | --- |
| Leave | EMP-ENG-001 | EMP-MGR-001 | HR/Admin override | EMP-FIN-001 tries to approve outside scope |
| Expense | EMP-ENG-001 | EMP-MGR-001 | EMP-FIN-002 | Employee tries finance approval |
| Payroll | EMP-FIN-001 | EMP-FIN-003 | EMP-FIN-004 | Same user attempts reviewer and approver roles if segregation required |
| Regularization | EMP-ENG-002 | EMP-MGR-001 | HR/Admin override | Manager outside hierarchy acts |
| Overtime | EMP-ENG-001 | EMP-MGR-001 | HR/Admin override | Overtime already approved gets re-approved |

### 14. End-To-End Data Chains

Use these complete chains for automation:

#### Chain A: Employee Lifecycle Happy Path
- Candidate: CAND-002.
- Job: JOB-QA-001.
- Offer: OFFER-001.
- Converted employee: EMP-NEW-001, name Mohit Saini.
- Onboarding template: ONB-TPL-001 with document, laptop, bank details, policy acknowledgement tasks.
- Expected final: employee ACTIVE, user login works, checklist completed, asset assigned.

#### Chain B: Attendance To Payroll
- Employee: EMP-ENG-001.
- Shift: SHIFT-DAY.
- Attendance: normal, late, overtime, approved leave in June 2026.
- Payroll month: June 2026.
- Expected final: payroll gross, LOP, OT, deductions, and net pay reconcile with golden sheet.

#### Chain C: Expense To Finance
- Employee: EMP-ENG-001.
- Claim: EXP-001.
- Manager: EMP-MGR-001.
- Finance approver: EMP-FIN-002.
- Expected final: claim transitions PENDING -> MANAGER_APPROVED -> FINANCE_APPROVED/PAID.

#### Chain D: Exit And FNF
- Employee: EMP-EXIT-001.
- Assets: AST-LAP-001 returned.
- Leave balance: earned leave 18.
- Exit date: 2026-06-30.
- Expected final: offboarding complete, FNF generated, employee status separated/inactive, login denied if account disabled.

### 15. Data Reset And Automation Notes

- Use unique suffixes for automated test records, for example `AUTO-${Date.now()}`.
- Keep one immutable golden payroll dataset for statutory verification.
- Do not reuse the same employee for destructive tests and payroll reconciliation.
- Separate UI smoke data from API destructive regression data.
- For file-upload tests, keep small valid fixtures and malicious/oversized fixtures in a controlled QA-only folder.
- For concurrency tests, create records inside the test and clean them using API or database teardown.
- For production smoke tests, use synthetic tenants and never real employee salary/statutory documents.
