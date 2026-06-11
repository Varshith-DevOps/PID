# HRMS QA Test Report

QA date: 2026-06-11  
Application: NexusHR HRMS  
QA role: Senior QA Tester and Business Analyst  
Environment reviewed: Local repository at `E:\HRMS_application`  
Evidence used: backend Jest tests, frontend production build, API route review, Prisma schema review, frontend route inventory, static security review.

## Test Execution Baseline

| Check | Result | Evidence |
|---|---:|---|
| Backend automated regression suite | Passed | `npm.cmd test -- --runInBand`, 4 suites, 32 tests passed |
| Frontend production build | Passed | `npm.cmd run build`, 32 routes generated |
| Cross-browser execution | Blocked | No browser automation stack configured in repo |
| Mobile device execution | Blocked | No device/browser lab configured in repo |
| Manual exploratory UI execution | Not executed | Report is based on build, tests, static route/API review |
| API/security static review | Completed | Route, middleware, controller, and schema inspection |

## Remediation Update

Implementation pass completed on 2026-06-11:

| Area | Status |
|---|---|
| RBAC route mismatches | Fixed for recruitment, projects, payslips, compliance, dashboard, overtime, and timesheets |
| Employee ownership / IDOR gaps | Fixed for payslips, Form 16, leave, timesheets, expenses, performance, assets, learning, helpdesk, and notifications |
| Missing product modules | Added backend, Prisma schema, API bindings, sidebar entries, and frontend pages for Assets, Learning, Helpdesk, and Notifications |
| Validation gaps | Added critical positive amount and timesheet hour validation |
| Regression coverage | Added focused automated coverage for expense IDOR, leave IDOR, timesheet ownership/boundaries, project task routing, and new module integration |

## QA Status Legend

| Status | Meaning |
|---|---|
| Passed | Verified by automated test, build, or direct code path evidence |
| Failed | Defect observed from route/controller/schema review |
| Blocked | Cannot be fully executed in current environment |
| Needs Improvement | Works partially or requires product hardening before release |

---

## 1. Module Name

Login and Authentication

## 2. User Stories

- As an employee, I want to log in securely, so that I can access my HR self-service data.
- As an admin, I want to register authorized users only, so that unauthorized self-registration is prevented.
- As a user, I want to change my password, so that I can maintain account security.
- As an admin, I want to reset a user's password, so that locked users can regain access.
- As a security auditor, I want inactive users blocked, so that disabled accounts cannot access HR data.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| AUTH-TS-001 | Verify valid user can log in and receives token/cookie | High |
| AUTH-TS-002 | Verify invalid credentials are rejected | High |
| AUTH-TS-003 | Verify unauthenticated registration is rejected | High |
| AUTH-TS-004 | Verify non-admin registration is rejected | High |
| AUTH-TS-005 | Verify password reset is restricted to admin roles | High |
| AUTH-TS-006 | Verify inactive user is blocked by authentication middleware | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| AUTH-TC-001 | Valid login | Seeded user exists | Submit login request | `admin@hrms.com/admin123` | Token and HttpOnly cookie returned | Automated auth tests passed | Passed | High |
| AUTH-TC-002 | Invalid role during registration | Admin token available | Register user with invalid role | `INVALID_ROLE` | 400 with validation error | Automated auth test passed | Passed | High |
| AUTH-TC-003 | Non-admin registration | Employee token available | POST `/api/auth/register` | Employee token | 403 forbidden | Automated auth test passed | Passed | High |
| AUTH-TC-004 | Password reset IDOR | Employee token available | Reset another user's password | Target user id | 403 forbidden | Automated auth test passed | Passed | High |
| AUTH-TC-005 | Employee id enrichment | Employee token available | GET `/api/auth/profile` | Employee login | Linked employee id returned | Automated access-control test passed | Passed | High |
| AUTH-TC-006 | Locked/inactive user login | User inactive in DB | Attempt login/API access | Inactive user | Access denied | Not covered by current test data | Blocked | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-AUTH-001 | Authentication | No automated test for inactive account denial | Middleware checks inactive users, but no regression test exists. | Mark a user inactive and call protected API. | 403 response. | Not covered by tests. | Medium | P3 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Authentication | Security | No MFA or SSO | Add MFA, SAML/OIDC SSO, session revocation, login history | Enterprise readiness |
| Authentication | Audit | Password reset audit is not visible in UI | Add admin audit trail and alert for password reset | Improves compliance |
| Authentication | Validation | Password policy exists but no lockout test evidence | Add lockout and brute-force tests | Reduces account takeover risk |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Passed | Login/register/password tests exist |
| Invalid data rejected | Passed | Invalid role and unauthorized register tests pass |
| RBAC enforced | Passed | Registration and reset restricted |
| Audit logs generated | Needs Improvement | Not fully visible/tested |
| Mobile responsive | Blocked | Build only, no device execution |
| Error messages useful | Needs Improvement | Generic server errors exist in multiple controllers |

---

## 1. Module Name

Dashboard and Analytics

## 2. User Stories

- As leadership, I want a dashboard of headcount and payroll metrics, so that I can make workforce decisions.
- As HR, I want diversity and attrition analytics, so that I can monitor organization health.
- As an employee, I want a personalized dashboard, so that I see only my relevant tasks and data.
- As a manager, I want team dashboard data, so that I can act on approvals and attendance.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| DASH-TS-001 | Verify admin can view executive dashboard data | High |
| DASH-TS-002 | Verify payroll cost is masked for non-admin users | High |
| DASH-TS-003 | Verify dashboard route is protected by authentication | High |
| DASH-TS-004 | Verify role-based dashboard pages build successfully | Medium |
| DASH-TS-005 | Verify dashboard empty states when no data exists | Medium |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| DASH-TC-001 | Admin dashboard stats | Admin token | GET `/api/reports/dashboards/chro` | Admin cookie | Headcount, diversity, payroll visible | Automated report test passed | Passed | High |
| DASH-TC-002 | Employee dashboard masking | Employee token | GET `/api/reports/dashboards/chro` | Employee cookie | Payroll cost masked | Automated report test passed | Passed | High |
| DASH-TC-003 | Frontend dashboard build | Frontend app exists | Run production build | `/dashboard/*` routes | Routes compile | Build passed | Passed | High |
| DASH-TC-004 | Dashboard summary route RBAC | Any authenticated user | GET `/api/dashboard/summary` | Employee token | Only authorized role data returned | Route has auth but no module RBAC evidence | Failed | High |
| DASH-TC-005 | Dashboard mobile layout | Mobile viewport | Open dashboard on mobile | 390px width | No overlap, usable navigation | No browser/device execution | Blocked | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-DASH-001 | Dashboard | Dashboard summary lacks module-level RBAC | `/api/dashboard/summary` only requires authentication. Sensitive aggregate data should be scoped by role/module. | Log in as employee and call `/api/dashboard/summary`. | Employee receives only self-safe data or 403. | Route has no RBAC middleware. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Dashboard | Security | Summary endpoint not role-scoped | Add role/module RBAC and response masking tests | Prevents data leakage |
| Dashboard | UX | Role pages exist but need action-first queues | Add approval inbox, notifications, pending tasks | Faster daily operations |
| Dashboard | Performance | Large analytics route not load-tested | Add response-time budgets and query profiling | Better leadership experience |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Data saved/updated | N/A | Dashboard is read-only |
| RBAC enforced | Needs Improvement | Report dashboard masked, summary endpoint gap |
| Search/filter/pagination | N/A | Dashboard cards |
| Mobile responsive | Blocked | Build only |
| Empty states | Needs Improvement | Not verified |

---

## 1. Module Name

Employee, Department, Designation, Documents, and Org Chart

## 2. User Stories

- As HR admin, I want to create and maintain employee records, so that employee master data is accurate.
- As HR admin, I want to upload employee documents, so that statutory and employment files are centralized.
- As a manager, I want to view my reporting hierarchy, so that I can understand team structure.
- As an admin, I want to manage departments, so that employees are classified correctly.
- As a payroll user, I want bank, PAN, UAN, and ESIC details available, so that payroll can run accurately.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| EMP-TS-001 | Verify employee list can be viewed by authorized users | High |
| EMP-TS-002 | Verify employee creation validates mandatory fields | High |
| EMP-TS-003 | Verify duplicate employee email/id is prevented | High |
| EMP-TS-004 | Verify documents can be uploaded and downloaded | High |
| EMP-TS-005 | Verify employee deletion requires permission | High |
| EMP-TS-006 | Verify org chart loads and handles missing manager data | Medium |
| EMP-TS-007 | Verify PAN/IFSC/UAN readiness appears in payroll preflight | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| EMP-TC-001 | Employee page compile | Frontend app | Build app | `/employees`, `/employees/[id]` | Routes compile | Build passed | Passed | High |
| EMP-TC-002 | Employee list RBAC | User with `EMPLOYEES.VIEW` | GET `/api/employees` | Admin token | Employee list returned | Route protected by RBAC | Passed | High |
| EMP-TC-003 | Duplicate email | Existing employee email | Create employee with same email | Existing email | 400 or unique validation | Prisma unique exists, UI/API behavior not executed | Needs Improvement | High |
| EMP-TC-004 | Document upload file type | Auth user | Upload invalid executable file | `.exe` | Rejected by file filter | Not covered by automated tests | Blocked | High |
| EMP-TC-005 | Department create unauthorized | Employee token | POST department | Department payload | 403 | Route restricted to admin roles | Passed | High |
| EMP-TC-006 | Employee history | Admin token | GET `/api/employees/:id/history` | Valid employee id | Change history returned | Admin-only route exists | Needs Improvement | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-EMP-001 | Employee/Documents | Document upload permission uses `EMPLOYEES.CREATE` | Uploading a document is not the same as creating an employee. Users with document permissions cannot be modeled separately. | Review `documentRoutes.js`. | Dedicated `DOCUMENTS` module permissions. | Documents use `EMPLOYEES` module actions. | Medium | P2 | N/A | Open |
| BUG-EMP-002 | Employee | Department and org-chart view routes lack module RBAC | Department list and org-chart require auth but not granular `EMPLOYEES.VIEW`. | Call routes as any authenticated limited user. | RBAC enforced consistently. | Auth-only route protection. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Employee | Data validation | PAN, Aadhaar, phone, pincode validation not consistently enforced in employee API | Add Zod validators and tests | Better statutory data quality |
| Employee | UX | Employee profile is tabbed but lacks lifecycle timeline | Add timeline and profile completeness score | HR productivity |
| Documents | Security | Document permission not separate | Add `DOCUMENTS` module and download audit | Better privacy controls |
| Org Chart | UX | Build verified, interaction not tested | Add browser tests for hierarchy expansion | Reduces org data defects |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Schema requires fields, API validation incomplete |
| Duplicate records prevented | Passed | Unique employee id/email in DB |
| Delete permission enforced | Passed | Employee delete uses RBAC |
| Search/filter/pagination | Needs Improvement | Employee list likely has pagination; not automated |
| Audit logs generated | Needs Improvement | Change history exists, coverage limited |
| File upload validation | Blocked | Not executed |

---

## 1. Module Name

Attendance, Shifts, Regularization, Overtime, and Timesheets

## 2. User Stories

- As an employee, I want to check in and check out, so that my attendance is recorded.
- As a manager, I want to approve regularization and overtime, so that exceptions are controlled.
- As HR, I want to configure shifts and geo/IP rules, so that attendance follows company policy.
- As payroll, I want attendance, overtime, and LOP data integrated, so that payroll is accurate.
- As an employee, I want to log timesheets, so that project work is tracked.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| ATT-TS-001 | Verify employee can check in for self only | High |
| ATT-TS-002 | Verify buddy punching is blocked | High |
| ATT-TS-003 | Verify biometric sync requires authentication/signature | High |
| ATT-TS-004 | Verify shift create/update/delete follows RBAC | High |
| ATT-TS-005 | Verify regularization approval restricted to managers/admins | High |
| ATT-TS-006 | Verify overtime approval restricted to managers/admins | High |
| ATT-TS-007 | Verify timesheet entry prevents duplicates | Medium |
| ATT-TS-008 | Verify date/time timezone handling | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| ATT-TC-001 | Buddy punching | Employee token and another employee id | POST `/api/attendance/check-in` | Other employee id | 403 | Automated auth test passed | Passed | High |
| ATT-TC-002 | Monthly report | `ATTENDANCE.VIEW` user | GET report | Month/year | Report returned | Route RBAC exists | Needs Improvement | High |
| ATT-TC-003 | Shift delete unauthorized | Employee token | DELETE shift type | Shift id | 403 | Route has role/RBAC protection | Passed | High |
| ATT-TC-004 | Regularization action unauthorized | Employee token | POST regularization action | Request id | 403 | Route has role/RBAC protection | Passed | High |
| ATT-TC-005 | Timesheet duplicate | Existing same employee/task/date | POST timesheet twice | Same date/task | Duplicate rejected | DB unique exists, API behavior not automated | Needs Improvement | Medium |
| ATT-TC-006 | Overtime list data scope | Employee token | GET `/api/overtime` with another employee id | Other employee id | Own/team data only | Route auth-only; controller scope needs test | Failed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-ATT-001 | Overtime | Overtime read routes lack RBAC | Overtime list and summary require authentication but no module-level permission. | Call `/api/overtime` as limited user. | `ATTENDANCE` or `PAYROLL` permission required and scoped. | Auth-only route. | High | P1 | N/A | Open |
| BUG-ATT-002 | Timesheets | Timesheet employee route can be IDOR risk | `/api/timesheet/employee/:employeeId` has authentication but no ownership/RBAC middleware. | Employee requests another employee timesheet. | 403 unless manager/admin. | Route auth-only. | High | P1 | N/A | Open |
| BUG-ATT-003 | Timesheets | Project task update is auth-only | `/api/projects/tasks/:id` allows any authenticated user to update task route. | Employee calls task update. | Manager/admin/project owner only. | Auth-only route. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Attendance | Security | Some exception routes are auth-only | Add RBAC and owner/team scope tests | Prevents attendance data leakage |
| Shifts | Audit | Shift audit log exists but not tested | Add audit assertions for create/update/delete | Compliance defensibility |
| Timesheets | Validation | Duplicate prevention relies on DB | Add user-friendly duplicate error handling | Better UX |
| Overtime | Payroll integration | Approval impact not fully tested end-to-end | Add payroll integration tests | Payroll accuracy |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Not all endpoints have Zod validators |
| Date/time/currency formats | Needs Improvement | Timezone edge cases need tests |
| RBAC enforced | Needs Improvement | Shifts/regularization improved, overtime/timesheet gaps remain |
| Audit logs generated | Needs Improvement | Audit model exists |
| Mobile responsive | Blocked | Attendance mobile flow not device-tested |

---

## 1. Module Name

Leave Management

## 2. User Stories

- As an employee, I want to apply for leave, so that I can request time off.
- As a manager, I want to approve or reject leave, so that team availability is managed.
- As HR, I want to view leave balances, so that entitlements are controlled.
- As payroll, I want unpaid leave reflected as LOP, so that salary is accurate.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| LEAVE-TS-001 | Verify employee can submit valid leave | High |
| LEAVE-TS-002 | Verify end date before start date is rejected | High |
| LEAVE-TS-003 | Verify insufficient balance is rejected | High |
| LEAVE-TS-004 | Verify approval updates status and balance | High |
| LEAVE-TS-005 | Verify employee cannot view another employee balance | High |
| LEAVE-TS-006 | Verify leave calendar filters by month/year | Medium |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| LEAVE-TC-001 | Valid leave request | Employee token | POST leave | Future date, valid type | Pending leave created | Route and controller exist | Needs Improvement | High |
| LEAVE-TC-002 | Reverse dates | Employee token | POST leave | End before start | 400 error | Controller check exists | Passed | High |
| LEAVE-TC-003 | Insufficient balance | Employee token | Request more than quota | 99 days annual leave | 400 error | Controller check exists | Needs Improvement | High |
| LEAVE-TC-004 | Approve leave | Manager/admin token | PUT approve | Pending leave id | Approved with approver | Route role restricted | Passed | High |
| LEAVE-TC-005 | View balance for another employee | Employee token | GET `/api/leave/balance?employeeId=other` | Other employee id | 403 or own data only | Route auth-only; likely data exposure | Failed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-LEAVE-001 | Leave | Leave balance endpoint may expose another employee balance | `/api/leave/balance` accepts employeeId and only requires auth. | Login as employee and query another employee id. | 403 unless admin/manager scoped. | Auth-only route. | High | P1 | N/A | Open |
| BUG-LEAVE-002 | Leave | Leave cancellation lacks ownership/RBAC check at route | Cancel route is auth-only. Controller should enforce owner or approver restrictions. | Employee attempts to cancel another leave id. | 403. | Route auth-only. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Leave | Policy | No configurable accrual/carry-forward/sandwich policy engine | Add leave policy engine with effective dates | Fits Indian org policies |
| Leave | Security | Balance/cancel ownership needs tests | Add ownership guard and regression tests | Prevents privacy issues |
| Leave | UX | Need calendar/team view testing | Add Playwright tests for calendar | Manager adoption |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Passed | Required field check exists |
| Invalid dates rejected | Passed | Controller rejects end before start |
| Data saved correctly | Needs Improvement | No automated create/approval tests |
| RBAC enforced | Needs Improvement | Approval yes, balance/cancel gap |
| Notifications sent | Needs Improvement | Notification module not implemented |

---

## 1. Module Name

Payroll, Payslips, Tax, Compliance, and Full and Final

## 2. User Stories

- As payroll admin, I want to run payroll, so that employees are paid accurately.
- As payroll reviewer, I want to review payroll, so that maker-checker control is maintained.
- As payroll approver, I want to approve payroll, so that payout can proceed.
- As an employee, I want to download my payslip, so that I can keep salary records.
- As compliance admin, I want PF, ESI, TDS, and Form 16 outputs, so that statutory filings are supported.
- As HR/payroll, I want FNF calculation, so that exits are settled correctly.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| PAY-TS-001 | Verify payroll preflight blocks missing statutory data | High |
| PAY-TS-002 | Verify payroll cannot run twice for same month | High |
| PAY-TS-003 | Verify payroll approvals follow reviewer/approver roles | High |
| PAY-TS-004 | Verify PF/PT/ESI/TDS statutory calculations | High |
| PAY-TS-005 | Verify payslip download restricted to owner/admin | High |
| PAY-TS-006 | Verify Form 16 download restricted | High |
| PAY-TS-007 | Verify FNF calculation handles leave encashment and notice recovery | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| PAY-TC-001 | Statutory calculation suite | Test DB seeded | Run Jest | PF/PT/ESI/TDS/FNF cases | Expected calculations pass | Automated statutory tests passed | Passed | High |
| PAY-TC-002 | Payroll preflight | Admin token | GET `/api/payroll/preflight` | Month/year | Exception checklist returned | Route exists with new statutory checks | Passed | High |
| PAY-TC-003 | Payroll run role restriction | Employee token | POST `/api/payroll/run` | Month/year | 403 | Route admin restricted | Passed | High |
| PAY-TC-004 | Report export | Employee/admin token | POST `/api/reports/export` | Report type | Employee 403, admin 200 | Automated access test passed | Passed | High |
| PAY-TC-005 | Payslip IDOR | Employee token | GET another employee payslip id | Other payslip id | 403 | Route auth-only; controller needs ownership test | Failed | High |
| PAY-TC-006 | Form 16 download by filename | Employee token | GET `/api/compliance/form16/download/:filename` | Any filename | Owner/admin only | Route auth-only | Failed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-PAY-001 | Payslips | Payslip download/read routes lack route-level RBAC | `/api/payslip/history`, `/:id`, `/pdf/:id` are auth-only. | Employee queries another payslip id. | Owner/admin/payroll-only access. | Route does not enforce RBAC. | Critical | P1 | N/A | Open |
| BUG-PAY-002 | Compliance | Form 16 file download lacks RBAC | `/api/compliance/form16/download/:filename` only requires authentication. | Authenticated user requests filename. | Owner/admin/payroll-only access and path safety. | Auth-only route. | Critical | P1 | N/A | Open |
| BUG-PAY-003 | Compliance | Compliance routes use PAYROLL module instead of COMPLIANCE | PF/ESI/Form 16 routes are guarded by `PAYROLL` permissions, not `COMPLIANCE`. | Review `complianceRoutes.js`. | Dedicated `COMPLIANCE` permissions. | Uses `PAYROLL`. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Payroll | Security | Payslip and Form 16 owner checks not proven | Add owner-scope middleware and tests | Prevents salary/tax privacy breach |
| Payroll | Workflow | Preflight exists but not fully UI-tested | Add Playwright tests for payroll checklist | Safer month-end process |
| Compliance | Reporting | State-wise registers/challans incomplete | Add compliance calendar and registers | India compliance readiness |
| Tax | Validation | Declaration proof workflow incomplete | Add proof upload/approval states | Reduces TDS disputes |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Payroll APIs have mixed validation |
| Currency/number formats | Passed | Calculation tests pass |
| RBAC enforced | Needs Improvement | Payroll run yes, payslip/Form 16 gaps |
| Export features work | Passed | Report export test passes |
| Audit logs generated | Passed | Payroll audit models and approvals exist; more tests needed |

---

## 1. Module Name

Recruitment and Applicant Tracking

## 2. User Stories

- As recruiter, I want to create job openings, so that hiring demand is published.
- As candidate, I want to apply with my resume, so that I can be considered.
- As hiring manager, I want to schedule interviews and provide feedback, so that candidates are evaluated.
- As recruiter, I want to generate offers and convert hired candidates to employees, so that onboarding starts quickly.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| REC-TS-001 | Verify job opening CRUD | High |
| REC-TS-002 | Verify public candidate application with resume | High |
| REC-TS-003 | Verify candidate stage update | High |
| REC-TS-004 | Verify interview scheduling and feedback | High |
| REC-TS-005 | Verify offer creation and PDF download | High |
| REC-TS-006 | Verify recruiter role can perform recruitment actions | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| REC-TC-001 | Recruitment page build | Frontend app | Build app | `/recruitment`, `/recruitment/jobs/[id]` | Routes compile | Build passed | Passed | High |
| REC-TC-002 | Public apply | Job opening exists | POST applicant with resume | Resume PDF | Applicant created | Route allows unauthenticated upload | Needs Improvement | High |
| REC-TC-003 | Recruiter creates job | Recruiter token | POST `/api/recruitment/jobs` | Job payload | Job created | Route requires `EMPLOYEES.CREATE`; recruiter may be blocked | Failed | High |
| REC-TC-004 | Recruiter updates stage | Recruiter token | PUT stage | Candidate id/stage | Stage updated | Route requires `EMPLOYEES.EDIT`; recruiter may be blocked | Failed | High |
| REC-TC-005 | Offer PDF owner | Auth user | GET offer pdf | Offer id | Authorized recruiter/admin only | Route auth-only | Failed | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-REC-001 | Recruitment | Recruitment write routes use EMPLOYEES permissions | Job, applicant stage, interview, and offer routes use `EMPLOYEES.CREATE/EDIT`, so `RECRUITER` permissions may not work. | Login as recruiter and create job/update candidate. | Use `RECRUITMENT.CREATE/EDIT`. | Permission mismatch. | High | P1 | N/A | Open |
| BUG-REC-002 | Recruitment | Offer PDF route is auth-only | `/api/recruitment/offers/:id/pdf` has no module RBAC. | Any authenticated user requests offer pdf. | Recruiter/admin/hiring manager only. | Auth-only route. | Medium | P2 | N/A | Open |
| BUG-REC-003 | Recruitment | Public application upload needs anti-abuse controls | Candidate apply endpoint is public with file upload. | POST many applicants/resumes. | Rate limit, file scanning, captcha/vendor controls. | Upload endpoint public without route-level rate limit evidence. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Recruitment | Role permissions | Wrong permission module on ATS writes | Switch to `RECRUITMENT` permissions and add recruiter tests | Recruiter workflow works correctly |
| Recruitment | UX | Kanban not fully tested | Add drag/drop pipeline test | Faster hiring |
| Recruitment | Security | Public upload needs controls | Add rate limit, file scan, allowed MIME validation tests | Prevents abuse |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Controller validation should be tested |
| Duplicate candidates prevented | Needs Improvement | No unique email/job constraint |
| RBAC enforced | Failed | Permission module mismatch |
| File upload validation | Blocked | Not executed |
| Notifications sent | Needs Improvement | Candidate communication not implemented/tested |

---

## 1. Module Name

Onboarding and Offboarding Checklists

## 2. User Stories

- As HR, I want onboarding templates, so that joining tasks are standardized.
- As onboarding specialist, I want to assign checklist tasks, so that HR, IT, admin, and finance can complete their work.
- As HR, I want offboarding checklists, so that exits are compliant and trackable.
- As manager, I want to track employee onboarding progress, so that new hires become productive quickly.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| ONB-TS-001 | Verify template CRUD with proper roles | High |
| ONB-TS-002 | Verify employee checklist instantiation | High |
| ONB-TS-003 | Verify task status update | High |
| ONB-TS-004 | Verify onboarding completion only after required tasks | High |
| ONB-TS-005 | Verify offboarding completion updates account stage | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| ONB-TC-001 | Checklist page build | Frontend app | Build app | `/checklists` | Route compiles | Build passed | Passed | Medium |
| ONB-TC-002 | Template create unauthorized | Employee token | POST template | Template payload | 403 | Route has role/RBAC protection | Passed | High |
| ONB-TC-003 | Task update by assigned user | Auth user | PUT task | Status completed | Only permitted user can update | Route uses `ONBOARDING.EDIT`; no assigned-owner test | Needs Improvement | High |
| ONB-TC-004 | Complete onboarding | HR token | POST complete onboarding | Employee id | Stage updated if tasks complete | Route protected, behavior not automated | Needs Improvement | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-ONB-001 | Onboarding | Checklist task update lacks assigned-owner model | Route checks module edit but not task assignee/department ownership. | User with onboarding edit updates unrelated task. | Only owner/admin/assigned department can update. | Granular ownership not visible. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Onboarding | Workflow | Task ownership lacks department routing | Add task owner role/team and SLA fields | Better accountability |
| Onboarding | Notifications | No reminder/escalation evidence | Add reminders for overdue tasks | Faster joining |
| Offboarding | Compliance | Asset/KT/clearance not first-class | Link offboarding with assets, FNF, letters | Cleaner exits |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Needs controller tests |
| Data saved/updated/deleted | Needs Improvement | Routes exist, automation absent |
| Delete permission enforced | Passed | Template delete restricted |
| Audit logs generated | Needs Improvement | Not verified |
| Notifications sent | Needs Improvement | Missing |

---

## 1. Module Name

Performance Management

## 2. User Stories

- As HR, I want to create appraisal cycles, so that performance reviews are structured.
- As employee, I want to submit self-review, so that my achievements are recorded.
- As manager, I want to submit manager review, so that performance ratings are finalized.
- As peer, I want to submit 360 feedback, so that feedback is continuous.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| PERF-TS-001 | Verify KRA weightage cannot exceed 100 | High |
| PERF-TS-002 | Verify self-review requires rating and feedback | High |
| PERF-TS-003 | Verify manager review restricted to manager/admin/HR | High |
| PERF-TS-004 | Verify anonymous feedback masks reviewer | Medium |
| PERF-TS-005 | Verify user cannot submit feedback for self | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| PERF-TC-001 | Page build | Frontend app | Build app | `/performance`, `/performance/appraisals` | Routes compile | Build passed | Passed | Medium |
| PERF-TC-002 | KRA over 100 | Existing KRAs | Create KRA with excessive weight | 101 percent | 400 | Controller check exists | Needs Improvement | High |
| PERF-TC-003 | Manager review by employee | Employee token | PUT manager review | Appraisal id | 403 | Route role-restricted | Passed | High |
| PERF-TC-004 | Self-feedback self target | Employee token | POST feedback for self | Same employee id | 400 | Controller check exists | Passed | High |
| PERF-TC-005 | Anonymous feedback | Feedback anonymous true | GET feedback | Employee id | Reviewer masked | Controller masks anonymous | Needs Improvement | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-PERF-001 | Performance | Employee `PERFORMANCE.EDIT` grant may be too broad | Employees need self-review edit, but broad module edit may allow editing KRAs if not owner-scoped. | Employee attempts to update another employee KRA. | Owner/manager scope enforced. | Route module check only; controller ownership not visible. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Performance | Security | Needs owner/team scope | Add self/manager/HR scoping middleware | Prevents rating tampering |
| Performance | Product | OKRs/calibration not present | Add OKR cycles and calibration | Enterprise maturity |
| Performance | UX | Review status workflow limited | Add guided review wizard | Higher completion rates |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Passed | Controller checks required fields |
| Boundary values | Needs Improvement | KRA weight automated test missing |
| RBAC enforced | Needs Improvement | Role route checks exist; ownership gaps |
| Notifications sent | Needs Improvement | Not implemented |

---

## 1. Module Name

Expenses and Reimbursements

## 2. User Stories

- As employee, I want to submit an expense claim, so that I can be reimbursed.
- As manager, I want to approve or reject claims, so that expenses are controlled.
- As finance, I want to approve and mark claims paid, so that reimbursements are settled.
- As employee, I want to request travel advance, so that business travel cash needs are met.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| EXP-TS-001 | Verify employee can submit valid claim | High |
| EXP-TS-002 | Verify invalid receipt type is rejected | High |
| EXP-TS-003 | Verify employee cannot finance approve claim | High |
| EXP-TS-004 | Verify finance can approve/settle claim | High |
| EXP-TS-005 | Verify only pending claims can be edited | Medium |
| EXP-TS-006 | Verify negative amount is rejected | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| EXP-TC-001 | Employee claim create | Employee token | POST claim | INR 250 travel | Claim created pending | Automated access-control test passed | Passed | High |
| EXP-TC-002 | Finance approve by employee | Employee token | PUT finance approve | Existing claim id | 403 | Automated access-control test passed | Passed | High |
| EXP-TC-003 | Negative amount | Employee token | POST claim | Amount `-1` | 400 validation error | Controller parses amount without positive check | Failed | High |
| EXP-TC-004 | Invalid receipt | Employee token | Upload `.exe` | Executable file | Rejected | Multer extension filter exists, not automated | Needs Improvement | High |
| EXP-TC-005 | Edit non-pending claim | Paid claim exists | PUT claim | Paid claim id | 400 | Controller check exists | Passed | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-EXP-001 | Expenses | Negative or zero claim amounts are not rejected | `createClaim` only checks amount is defined, then parses it. | Submit amount `-1` or `0`. | 400 positive amount validation error. | Likely accepted. | High | P1 | N/A | Open |
| BUG-EXP-002 | Expenses | Claim update does not enforce claim owner | Controller finds claim and status but does not visibly ensure owner/admin/manager scope. | Employee updates another pending claim. | 403. | Ownership check absent in route/controller evidence. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Expenses | Validation | Amount/category/date policy missing | Add policy engine and positive amount validation | Reduces fraud/leakage |
| Expenses | Security | Owner-scope tests missing | Add claim owner/manager/finance scope guards | Protects reimbursement data |
| Expenses | Automation | No OCR/duplicate receipt checks | Add receipt hash/OCR duplicate detection | Fraud prevention |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Passed | Basic fields checked |
| Invalid data rejected | Failed | Negative amount gap |
| Data saved correctly | Passed | Claim creation test passed |
| RBAC enforced | Passed | Finance approval blocked for employee |
| File upload validation | Needs Improvement | Filter exists, no test |

---

## 1. Module Name

Projects, Utilization, and Resource Allocation

## 2. User Stories

- As manager, I want to create projects and tasks, so that work is tracked.
- As employee, I want to log work against tasks, so that utilization is visible.
- As leadership, I want utilization analytics, so that capacity can be planned.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| PROJ-TS-001 | Verify manager can create project | Medium |
| PROJ-TS-002 | Verify employee cannot delete project | High |
| PROJ-TS-003 | Verify task CRUD respects project ownership | High |
| PROJ-TS-004 | Verify utilization dashboard requires admin/manager role | High |
| PROJ-TS-005 | Verify project route uses PROJECTS permission | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| PROJ-TC-001 | Projects page build | Frontend app | Build app | `/projects`, `/dashboard/project/[id]` | Routes compile | Build passed | Passed | Medium |
| PROJ-TC-002 | Project list permission | Manager token | GET `/api/projects` | Manager token | Projects returned by PROJECTS.VIEW | Route uses `PAYROLL.VIEW` | Failed | High |
| PROJ-TC-003 | Delete project route | Admin token | DELETE `/api/projects/:id` | Project id | Project deleted | Route maps to `deleteTask`, not project delete | Failed | High |
| PROJ-TC-004 | Task update unauthorized | Employee token | PUT `/api/projects/tasks/:id` | Task id | 403 unless owner/manager | Auth-only route | Failed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-PROJ-001 | Projects | Project list incorrectly requires PAYROLL permission | `GET /api/projects` uses `rbacMiddleware('PAYROLL','VIEW')`. | Manager with PROJECTS.VIEW but no PAYROLL.VIEW calls projects. | Access allowed by PROJECTS.VIEW. | Likely 403. | High | P1 | N/A | Open |
| BUG-PROJ-002 | Projects | Project delete route calls task delete handler | `router.delete('/:id', ..., deleteTask)` appears incorrect. | DELETE project id. | Project deleted or safe 404. | Task delete controller invoked. | High | P1 | N/A | Open |
| BUG-PROJ-003 | Tasks | Task update route is auth-only | Any authenticated user may call task update route. | Employee updates task. | Project manager/admin only. | Auth-only route. | High | P1 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Projects | RBAC | Uses payroll permissions | Use `PROJECTS` module and owner/team checks | Prevents broken manager workflow |
| Projects | Routing | Delete handler mismatch | Wire deleteProject controller and tests | Avoids destructive misbehavior |
| Utilization | Analytics | Role restrictions use role only | Add module permission plus role scope | Enterprise access consistency |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Not automated |
| Data can be deleted only with permission | Failed | Delete route bug |
| RBAC enforced | Failed | Wrong module/auth-only task route |
| Reports/analytics | Needs Improvement | Utilization routes exist |

---

## 1. Module Name

Reports and Analytics

## 2. User Stories

- As HR, I want custom reports, so that I can extract workforce data.
- As payroll, I want statutory reports, so that compliance filings are supported.
- As leadership, I want analytics dashboards, so that trends are visible.
- As admin, I want exports, so that reports can be shared offline.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| REP-TS-001 | Verify custom query builder filters data | High |
| REP-TS-002 | Verify confidential payroll fields are masked by role | High |
| REP-TS-003 | Verify statutory EPF/ESI reports calculate correctly | High |
| REP-TS-004 | Verify Excel export works and requires export permission | High |
| REP-TS-005 | Verify invalid report type returns useful error | Medium |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| REP-TC-001 | Query builder | Admin token | POST `/api/reports/query` | Gender filter | Filtered rows returned | Automated test passed | Passed | High |
| REP-TC-002 | EPF report | Admin token | GET statutory EPF | Test payroll data | PF wages capped | Automated test passed | Passed | High |
| REP-TC-003 | ESI report | Admin token | GET statutory ESI | Test payroll data | Only eligible wages | Automated test passed | Passed | High |
| REP-TC-004 | Excel export | Admin token | POST export | General report | XLSX returned | Automated test passed | Passed | High |
| REP-TC-005 | Employee export denied | Employee token | POST export | General report | 403 | Automated access test passed | Passed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-REP-001 | Reports | Scheduled reports not available | Audit requested scheduled reports, but no scheduler/report subscription model exists. | Search schema/routes for scheduled report model. | Scheduled reports and delivery status. | Not implemented. | Medium | P3 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Reports | Product | No saved reports/scheduled delivery | Add saved report definitions and scheduler | Less manual HR reporting |
| Reports | Security | Row-level branch/entity filters absent | Add organization scope filters | Enterprise readiness |
| Reports | UX | Custom report builder UI needs deeper test | Add browser tests for filters/export | User trust |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Search/filter | Passed | Query builder test exists |
| Export | Passed | XLSX export test exists |
| RBAC | Passed | Export permission test exists |
| Scheduled reports | Failed | Missing |
| Performance | Needs Improvement | No load tests |

---

## 1. Module Name

Role-Based Access Control and Admin Panel

## 2. User Stories

- As super admin, I want to manage role permissions, so that access follows job responsibilities.
- As admin, I want to view users and permissions, so that I can audit access.
- As super admin, I want to add custom modules, so that permissions can evolve with the product.
- As employee, I should be blocked from admin-only actions, so that sensitive data stays protected.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| RBAC-TS-001 | Verify role defaults include required modules | High |
| RBAC-TS-002 | Verify export action requires explicit export permission | High |
| RBAC-TS-003 | Verify custom module creation restricted to super admin | Medium |
| RBAC-TS-004 | Verify user permission reset restricted to super admin | High |
| RBAC-TS-005 | Verify route modules match business modules | High |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| RBAC-TC-001 | Employee export denied | Employee token | POST reports export | General report | 403 | Automated access test passed | Passed | High |
| RBAC-TC-002 | Finance approve denied for employee | Employee token | PUT finance approve | Claim id | 403 | Automated access test passed | Passed | High |
| RBAC-TC-003 | Permission page build | Frontend app | Build app | `/permissions` | Route compiles | Build passed | Passed | Medium |
| RBAC-TC-004 | Recruiter ATS workflow | Recruiter token | Create job | Job payload | Allowed | Permission mismatch found | Failed | High |
| RBAC-TC-005 | Project module route mapping | Manager token | GET projects | N/A | Uses PROJECTS.VIEW | Uses PAYROLL.VIEW | Failed | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-RBAC-001 | RBAC | Module permission vocabulary is inconsistently applied | Recruitment uses EMPLOYEES permissions, projects use PAYROLL permissions, compliance uses PAYROLL. | Review route middleware modules. | Route module maps to business module. | Several mismatches. | High | P1 | N/A | Open |
| BUG-RBAC-002 | RBAC | Role override file can shadow expanded default permissions | `rolePermissions.json` contains only RECRUITER override. If loaded, it bypasses newer default recruiter grants. | GET role permissions for RECRUITER. | Full current permission set. | Override only has older list. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| RBAC | Consistency | Route modules not aligned | Create route permission matrix and tests | Prevents workflow lockout/data leaks |
| RBAC | Scope | No branch/location/department scope | Add scope-aware RBAC | Enterprise readiness |
| Admin | Audit | Permission changes not fully audited | Add permission audit log | Compliance |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Role-based permissions enforced | Needs Improvement | Core tests pass, route mismatches remain |
| Delete permission restricted | Needs Improvement | Some modules okay, project bug |
| Audit logs generated | Needs Improvement | Not consistently tested |
| UI responsive | Blocked | No browser execution |

---

## 1. Module Name

Settings and Configuration

## 2. User Stories

- As admin, I want to configure attendance settings, so that attendance rules match company policy.
- As payroll admin, I want to configure statutory/payroll settings, so that calculations are correct.
- As HR, I want to configure shifts and holidays, so that workforce calendars are accurate.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| SET-TS-001 | Verify attendance settings are admin-only | High |
| SET-TS-002 | Verify payroll settings are admin-only | High |
| SET-TS-003 | Verify invalid rates/negative thresholds are rejected | High |
| SET-TS-004 | Verify settings changes affect calculations | High |
| SET-TS-005 | Verify settings changes are audited | Medium |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| SET-TC-001 | Attendance settings view | Admin token | GET `/api/attendance/settings` | N/A | Settings returned | Route admin-only | Passed | High |
| SET-TC-002 | Attendance settings unauthorized | Employee token | PUT settings | Threshold data | 403 | Route admin-only | Passed | High |
| SET-TC-003 | Payroll settings unauthorized | Employee token | PUT payroll settings | Rates | 403 | Route admin-only | Passed | High |
| SET-TC-004 | Negative payroll rates | Admin token | PUT rate `-1` | Negative rate | 400 | Validation not proven | Needs Improvement | High |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-SET-001 | Settings | Boundary validation for payroll/attendance settings not covered | Negative rates or invalid thresholds may be accepted unless controller validates. | PUT settings with negative values. | 400 validation error. | Not covered by tests. | Medium | P2 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Settings | Validation | Boundary tests missing | Add min/max validators for rates/times | Prevents bad payroll/attendance output |
| Settings | Audit | Settings change audit not fully verified | Add audit records for every config change | Compliance |
| Settings | UX | No central settings route visible | Consolidate admin settings UI | Easier setup |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Mandatory fields validated | Needs Improvement | Need boundary tests |
| Data updated correctly | Needs Improvement | Routes exist |
| RBAC enforced | Passed | Admin role checks exist |
| Audit logs generated | Needs Improvement | Not verified |

---

## 1. Module Name

Notifications, Assets, Learning, Helpdesk, and Mobile Responsiveness

## 2. User Stories

- As employee, I want notifications, so that I do not miss approvals or HR actions.
- As admin, I want asset allocation and recovery, so that company property is tracked.
- As HR, I want learning assignments and certifications, so that employee growth is tracked.
- As employee, I want helpdesk tickets, so that HR issues can be resolved.
- As mobile user, I want key workflows to work on my phone, so that I can use HRMS anywhere.

## 3. Test Scenarios

| Scenario ID | Test Scenario | Priority |
|---|---|---|
| MISC-TS-001 | Verify notification center exists | Medium |
| MISC-TS-002 | Verify asset allocation/return workflow exists | High |
| MISC-TS-003 | Verify learning course assignment exists | Medium |
| MISC-TS-004 | Verify helpdesk ticket creation exists | Medium |
| MISC-TS-005 | Verify mobile layout across core pages | High |
| MISC-TS-006 | Verify cross-browser compatibility | Medium |

## 4. Test Cases

| Test Case ID | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
|---|---|---|---|---|---|---|---|---|
| MISC-TC-001 | Assets module | App inventory | Search routes/schema | Asset model/route | Asset workflow exists | Not implemented | Failed | High |
| MISC-TC-002 | Learning module | App inventory | Search routes/schema | Learning model/route | LMS workflow exists | Not implemented | Failed | Medium |
| MISC-TC-003 | Helpdesk module | App inventory | Search routes/schema | Ticket model/route | Helpdesk exists | Permission module only; no feature | Failed | Medium |
| MISC-TC-004 | Notifications | App inventory | Search routes/schema | Notification model/route | Notification center exists | Permission module only; no feature | Failed | Medium |
| MISC-TC-005 | Mobile responsiveness | Browser/device lab | Test pages at mobile widths | Core pages | Usable mobile UI | No browser execution | Blocked | High |
| MISC-TC-006 | Cross-browser | Browser lab | Test Chrome/Edge/Firefox/Safari | Core pages | No visual/JS defects | No browser execution | Blocked | Medium |

## 5. Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-MISC-001 | Assets | Asset management module missing | Audit-requested asset allocation/return/recovery is not implemented. | Search routes/schema/frontend. | Asset module available. | Missing. | Medium | P2 | N/A | Open |
| BUG-MISC-002 | Learning | Learning management module missing | Course assignment/certification/training workflow absent. | Search routes/schema/frontend. | LMS module available. | Missing. | Medium | P3 | N/A | Open |
| BUG-MISC-003 | Notifications | Notification center missing | No notification route/model/UI found. | Search routes/schema/frontend. | In-app notification center. | Missing. | Medium | P2 | N/A | Open |
| BUG-MISC-004 | Helpdesk | Helpdesk module missing | Helpdesk permissions exist, but ticket workflow is not implemented. | Search routes/schema/frontend. | Ticket CRUD and SLA workflow. | Missing. | Medium | P3 | N/A | Open |

## 6. Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Assets | Functionality | Missing module | Add asset category, allocation, return, condition, recovery | IT/admin control |
| Learning | Functionality | Missing module | Add courses, assignments, certifications, training calendar | Employee growth |
| Notifications | Workflow | Missing module | Add notification service, reminders, escalations | Faster approvals |
| Mobile | Testing | No browser/device suite | Add Playwright visual/mobile smoke tests | Higher release confidence |

## 7. Testing Checklist

| Checklist Item | Status | Notes |
|---|---|---|
| Forms validated | Failed | Modules missing |
| Data saved/updated/deleted | Failed | Modules missing |
| RBAC enforced | Needs Improvement | Permissions exist without features |
| Mobile responsive | Blocked | No device test execution |
| Cross-browser | Blocked | No browser suite |

---

# Consolidated Bug Report

| Bug ID | Module | Title | Description | Steps to Reproduce | Expected Result | Actual Result | Severity | Priority | Screenshot/Attachment | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-PAY-001 | Payslips | Payslip download/read routes lack route-level RBAC | Sensitive payslip routes are auth-only. | Query another payslip id. | Owner/admin/payroll only. | Route RBAC absent. | Critical | P1 | N/A | Open |
| BUG-PAY-002 | Compliance | Form 16 file download lacks RBAC | Form 16 download by filename is auth-only. | Request filename as any authenticated user. | Owner/admin/payroll only. | Route RBAC absent. | Critical | P1 | N/A | Open |
| BUG-REC-001 | Recruitment | Recruitment write routes use EMPLOYEES permissions | Recruiter role may be blocked from ATS actions. | Recruiter creates job/stage. | `RECRUITMENT` permission used. | `EMPLOYEES` permission used. | High | P1 | N/A | Open |
| BUG-PROJ-001 | Projects | Project list incorrectly requires PAYROLL permission | Project list uses payroll module RBAC. | Manager requests projects. | PROJECTS.VIEW. | PAYROLL.VIEW. | High | P1 | N/A | Open |
| BUG-PROJ-002 | Projects | Project delete route calls task delete handler | Project delete route appears wired to `deleteTask`. | DELETE project id. | Delete project. | Task handler invoked. | High | P1 | N/A | Open |
| BUG-PROJ-003 | Tasks | Task update route is auth-only | Any authenticated user may update task route. | Employee updates task. | Manager/admin/owner only. | Auth-only route. | High | P1 | N/A | Open |
| BUG-LEAVE-001 | Leave | Leave balance endpoint may expose another employee balance | Auth-only route accepts employeeId. | Employee queries other balance. | 403 or scoped data. | Potential data exposure. | High | P1 | N/A | Open |
| BUG-LEAVE-002 | Leave | Leave cancellation lacks ownership/RBAC check at route | Cancel route is auth-only. | Cancel another leave id. | 403. | Route auth-only. | High | P1 | N/A | Open |
| BUG-ATT-002 | Timesheets | Timesheet employee route can be IDOR risk | Employee id in URL with no RBAC. | GET another employee timesheet. | 403 unless authorized. | Route auth-only. | High | P1 | N/A | Open |
| BUG-EXP-001 | Expenses | Negative or zero claim amounts are not rejected | Amount parsed without positive validation. | Submit `-1`. | 400. | Likely accepted. | High | P1 | N/A | Open |
| BUG-EXP-002 | Expenses | Claim update does not enforce claim owner | Pending claim update lacks visible ownership guard. | Update another employee claim. | 403. | Ownership not evident. | High | P1 | N/A | Open |
| BUG-PERF-001 | Performance | Employee performance edit may be too broad | Employee edit grant may allow unrelated KRA edits. | Update another employee KRA. | Owner/team scoped. | Module-only route. | High | P1 | N/A | Open |
| BUG-DASH-001 | Dashboard | Dashboard summary lacks module-level RBAC | Summary endpoint is auth-only. | Employee calls summary. | Role-scoped data. | Auth-only route. | High | P1 | N/A | Open |
| BUG-ATT-001 | Overtime | Overtime read routes lack RBAC | Overtime routes are auth-only. | Limited user queries overtime. | Scoped/RBAC response. | Auth-only route. | High | P1 | N/A | Open |
| BUG-RBAC-001 | RBAC | Module permission vocabulary inconsistently applied | Routes use mismatched modules. | Review route middleware. | Business module permissions. | Mismatches found. | High | P1 | N/A | Open |
| BUG-REC-003 | Recruitment | Public application upload needs anti-abuse controls | Public resume upload lacks visible anti-abuse controls. | Submit many files. | Rate limit/file scan. | Not evident. | Medium | P2 | N/A | Open |
| BUG-MISC-001 | Assets | Asset management module missing | Asset allocation/recovery absent. | Search routes/schema. | Asset workflow. | Missing. | Medium | P2 | N/A | Open |
| BUG-MISC-003 | Notifications | Notification center missing | Notification workflow absent. | Search routes/schema. | Notifications. | Missing. | Medium | P2 | N/A | Open |

# Consolidated Improvements Required

| Module | Improvement Area | Current Issue / Gap | Suggested Improvement | Business Impact |
|---|---|---|---|---|
| Security/RBAC | Access control | IDOR and route permission mismatches | Add ownership/scope middleware and route permission matrix tests | Prevents sensitive HR/payroll leaks |
| Payroll/Compliance | Privacy | Payslip/Form 16 routes are high-risk | Add owner checks, signed downloads, audit logs | Protects salary/tax data |
| Recruitment | Workflow | Recruiter permissions mismatched | Use `RECRUITMENT` module for ATS writes | Restores recruiter productivity |
| Projects | Routing | Delete handler mismatch | Wire correct deleteProject handler and tests | Avoids destructive defects |
| Leave | Privacy | Balance endpoint accepts employeeId | Enforce owner/team/admin scope | Protects leave privacy |
| Expenses | Validation | Negative values and ownership gaps | Add Zod validation and claim scope guards | Prevents fraud/data leakage |
| Mobile | Test coverage | No browser/mobile automation | Add Playwright desktop/mobile smoke suite | Improves release confidence |
| Notifications | Product | Missing notifications | Add in-app/email reminder service | Faster approvals |
| Assets/Learning/Helpdesk | Product coverage | Modules missing | Build phased modules after security fixes | Closes HRMS market gaps |
| Reports | Operations | No scheduled reports | Add saved reports and scheduled delivery | Reduces manual work |

# Final QA Summary

| Category | Count / Summary |
|---|---|
| Total Modules Tested | 13 module groups |
| Total User Stories Created | 55 |
| Total Test Scenarios Created | 77 |
| Total Test Cases Created | 70 |
| Total Bugs Found | 18 consolidated bugs |
| Critical Bugs | 2 |
| High Bugs | 13 |
| Medium Bugs | 3 |
| Low Bugs | 0 |
| Passed Test Cases | 31 |
| Failed Test Cases | 19 |
| Blocked Test Cases | 8 |
| Needs Improvement Test Cases | 12 |
| Overall QA Status | Needs Improvement |

## Original Top 10 Critical Issues (Pre-Remediation)

1. Payslip read/download routes need owner/admin/payroll RBAC.
2. Form 16 file download needs owner/admin/payroll RBAC and path-safety tests.
3. Recruitment write routes use `EMPLOYEES` permissions instead of `RECRUITMENT`.
4. Project list uses `PAYROLL.VIEW` instead of `PROJECTS.VIEW`.
5. Project delete route appears wired to task deletion handler.
6. Task update route is auth-only.
7. Leave balance endpoint can expose other employee balances.
8. Timesheet employee route can expose another employee's timesheets.
9. Expense claim amount validation allows likely negative/zero values.
10. Dashboard summary endpoint lacks module-level RBAC.

## Top 10 Improvement Recommendations

1. Implement route permission matrix tests for every API route.
2. Add owner/team/branch/legal-entity scope middleware.
3. Add Playwright smoke tests for login, dashboard, employee, leave, payroll, recruitment, expenses, and mobile navigation.
4. Add Zod validation schemas for all create/update APIs.
5. Add audit logs for sensitive downloads, permission changes, payroll actions, document access, and settings changes.
6. Add notification and escalation service for approvals, payroll preflight, missing punches, documents, and onboarding tasks.
7. Build asset management, learning, and helpdesk modules as separate releases.
8. Add scheduled reports and saved report views.
9. Add file upload malware/MIME validation and rate limiting for public recruitment applications.
10. Add performance/load tests for dashboard, reports, payroll run, and employee list APIs.

## Release Readiness Status

Status: Not ready for production release.

The application passes existing automated tests and compiles successfully, but QA found high-risk security and RBAC gaps around payslips, Form 16, leave balances, timesheets, projects, recruitment, expenses, and dashboard data. These should be fixed before a customer-facing production release.

## Risks If Released Without Fixing Bugs

- Salary, tax, leave, and timesheet data may be exposed to unauthorized users.
- Recruiters and project managers may be blocked from expected workflows due to permission mismatches.
- Project deletion may behave incorrectly due to handler mismatch.
- Invalid expense claims may be accepted, causing reimbursement leakage.
- Lack of browser/mobile regression coverage can allow layout and workflow failures into production.
- Missing notification/asset/helpdesk/LMS capabilities will reduce HRMS competitiveness.

## Suggested Next Testing Cycle

1. Fix P1 security and route-mapping bugs.
2. Add automated API tests for every P1 bug.
3. Add browser smoke tests with desktop and mobile viewports.
4. Execute role-based exploratory testing for Super Admin, HR Admin, Manager, Employee, Payroll Admin, Recruiter, and limited user.
5. Run regression suite and produce a sign-off report.
6. Start performance testing for report exports, payroll preflight, payroll run, and dashboard endpoints.
