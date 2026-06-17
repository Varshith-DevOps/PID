# 01. Functional Requirements Document (FRD) — NexusHR HRMS

## 1. Document Overview & Purpose

This Functional Requirements Document (FRD) defines the functional specifications and business rules of the NexusHR HRMS application. This document translates the code structures and API behaviors of the active application into clear business terms for stakeholders, developers, designers, and testers.

---

## 2. Project Overview & Business Goals

NexusHR is an enterprise-oriented, India-compliant Human Resource Management System (HRMS). Its primary goals are to:
1. **Consolidate HR Records:** Provide a single source of truth for employee personal, professional, and statutory data.
2. **Automate Attendance & Rosters:** Support multi-mode clock-ins (web, biometric, mobile geo-location) with shift assignments.
3. **Streamline Payroll & India Statutory Compliance:** Handle automated calculation and tax projections of employee salaries under Indian laws, generating compliance returns (EPFO ECR, ESIC reports, Form 16, Professional Tax, Labor Welfare Fund).
4. **Orchestrate Talent Processes:** Provide structured ATS recruitment, onboarding checklists, performance appraisals, expense management, project logging, and F&F exit processing.

---

## 3. User Personas & Permissions Matrix

The system maps authorization permissions dynamically using 12 roles across 21 modules.

### Roles and Personas
1. **Super Admin (`SUPER_ADMIN`):** Full control over configurations, permissions, system settings, database management.
2. **Admin (`ADMIN`):** General operational access to employee, department, shift, checklist, and payroll features.
3. **HR Admin (`HR`):** Manage employee records, onboarding, leave/attendance exceptions, recruitment, and performance.
4. **Manager (`MANAGER`):** View team profiles, approve timesheets, approve leave/regularizations, and complete appraisals.
5. **Employee (`EMPLOYEE`):** Self-service portal (ESS) for attendance, leave, tax declarations, expenses, and task logging.
6. **Recruiter (`RECRUITER`):** Handle job listings, candidate screening, interviews, and offer letters.
7. **Onboarding Specialist (`ONBOARDING`):** Orchestrate pre-joining check-lists and candidate conversion processes.
8. **Accounts Officer (`ACCOUNTS`):** Process payroll runs, review salary structures, and manage financial details.
9. **Finance Officer (`FINANCE`):** Verify expense claims, process disbursements, and approve payroll.
10. **Payroll Reviewer (`PAYROLL_REVIEWER`):** Audit payroll runs and check statutory contributions.
11. **Payroll Approver (`PAYROLL_APPROVER`):** Perform final lock on payroll runs to execute salary payouts.

### Permissions Matrix (Modules vs. Roles Defaults)
*   **Super Admin:** Uncapped permissions across all actions (`VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT`) for all modules.
*   **Employee:** Allowed `VIEW` of own attendance, leaves, payroll, tax declarations, performance, assets, helpdesk, and notifications. Allowed `CREATE` of leave requests, expense claims, tax declarations, timesheets, and helpdesk tickets. `DELETE` is fully blocked.
*   **Manager:** Allowed `VIEW` of subordinates. Allowed `EDIT` (approvals) of team attendance, leaves, projects, expenses, performance, and helpdesk.
*   **Recruiter:** Scoped to `RECRUITMENT` (`VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT`), plus `VIEW` access on Employees and Projects.
*   **Finance:** Fully scoped to `PAYROLL`, `COMPLIANCE`, `EXPENSES`, `ACCOUNTS`, and `REPORTS`.

---

## 4. Module-Wise Requirements

### 4.1 Authentication & Multi-Factor Auth (MFA)
*   **Business Purpose:** Prevent unauthorized access to sensitive employee salary and statutory data.
*   **Actors:** All Personas.
*   **Features:** Email-based JWT login, optional MFA (setup, enable, verify, recovery codes), password modifications.
*   **Business Rules & Validations:**
    *   MFA recovery codes must be generated as a list and can be used to bypass MFA validation.
    *   Rate limiting is enforced on login, registration, and MFA validation requests (max 5 attempts per minute).
*   **Inputs:** Email, Password, MFA Token (optional).
*   **Outputs:** JWT cookie or JSON payload containing active user profile and permission list.
*   **Dependencies:** User and Permission models.

### 4.2 Employee Master Management
*   **Business Purpose:** Maintain historical records of personal, professional, bank, and statutory details.
*   **Actors:** Employee (ESS view), HR Admin, Admin, Super Admin.
*   **Features:** Employee Profile CRUD, Bank details, PF details, Addresses (current/permanent), Education details, Professional experience, Dependents, Salary revisions, exit settle triggers, and document attachments.
*   **Business & Validation Rules:**
    *   *Gap:* PAN, Aadhar, and PF numbers are collected but lack real-time API verification checks.
    *   *Assumption:* Deleting an employee executes a soft-delete (setting `isActive = false`) to preserve historical payroll runs.
*   **Inputs:** Name, Email, Job Title, Department, Date of Join, Salary, PAN (optional), Aadhar (optional).
*   **Outputs:** Profile details, PDF document storage, audit change history logs.

### 4.3 Attendance Operations
*   **Business Purpose:** Track employee work times to calculate monthly salary loss-of-pay (LOP).
*   **Actors:** Employee, Manager, HR Admin.
*   **Features:** Web punch check-in/out, Geolocation validation, IP limits, Biometric device feed uploads, monthly attendance regularizations.
*   **Business & Validation Rules:**
    *   *Bug/Gap:* Punch regularizations calculate late minutes using server timezone context instead of Asia/Kolkata timezone, causing wrong lateness flags when servers run in UTC.
    *   *Business Rule:* A punch is flagged as LATE if check-in is after the threshold limit defined in `AttendanceSettings` (default: 30-minute grace period).
*   **Dependencies:** ShiftAssignment and AttendanceSettings.

### 4.4 Leave Management
*   **Business Purpose:** Coordinate time-off requests without halting business operations.
*   **Actors:** Employee, Manager, HR Admin.
*   **Features:** Submit leave request, check leave balance, approve/reject workflow.
*   **Business & Validation Rules:**
    *   *Bug 1 (Critical):* Leave requests do not check if `endDate >= startDate`. Submission with `endDate < startDate` generates negative leave days, artificially inflating the employee's balance when approved.
    *   *Bug 2 (Critical):* No validation checks if an employee has sufficient balance before requesting leave, leading to negative leave balances.
    *   *Business Rule:* Only UNPAID leaves trigger salary deductions in payroll processing (leaves with negative Sick/Casual balances are paid in full due to LOP calculation flaws).

### 4.5 Roster & Shift Management
*   **Business Purpose:** Coordinate employee shifts across multi-location branches.
*   **Actors:** HR Admin, Manager.
*   **Features:** Define shift types, assign shifts to employees, track night transport security confirmations.
*   **Business Rules:** Night shift assignments for women require a safety confirmation check (`womenSafetyConfirmed = true`) and transport tracking detail.
*   **Inputs:** Shift start/end times, grace period, weekly offs, geofence radius.

### 4.6 Statutory Payroll Processing
*   **Business Purpose:** Compute accurate salaries and compliance deductions under Indian laws.
*   **Actors:** Accounts Officer, Finance Officer, Payroll Reviewer, Payroll Approver.
*   **Features:** Salary Structure setup, Loss-of-pay deductions, Overtime calculation, PF/ESI/PT/LWF contributions, Payroll Runs, Approvals, Reversals, and Audit logs.
*   **Business & Validation Rules:**
    *   *Bug 1 (EDLI Ceiling):* EDLI contribution is calculated on the full basic salary instead of capping at the statutory ₹15,000 ceiling.
    *   *Bug 2 (Tamil Nadu PT):* Slabs are semi-annual, but deductions are executed monthly, violating the constitutional ceiling of ₹2,500/year.
    *   *Bug 3 (Overtime Rate):* Factories Act requires overtime at double the rate of ordinary wages (Basic + allowances). The code only uses `basicSalary` to calculate OT.
    *   *Gap/Bug:* Payroll calculations are not wrapped in database transactions, meaning a crash mid-run leaves partial records.

### 4.7 Exits & Full and Final (F&F) Settlement
*   **Business Purpose:** Process employee offboarding settlements.
*   **Actors:** HR Admin, Admin.
*   **Features:** Record resignation, track notice shortfalls, calculate leave encashments, finalize payouts.
*   **Business & Validation Rules:**
    *   *Bug 1 (Critical Crash):* Finalizing F&F attempts to save a `remarks` string in `ExitDetails`, which does not exist in the database schema, causing the process to fail.
    *   *Bug 2 (Encashment Payout):* Encashment pays out SICK and CASUAL leaves instead of letting them lapse, leading to unnecessary payouts.
    *   *Bug 3 (Notice recovery):* SHORTFALL is incorrectly computed using the current month's days worked instead of subtracting notice days from the actual exit period.

---

## 5. Requirements Traceability Matrix (RTM)

| Requirement ID | Module | Requirement Description | Priority | Status | Evidence/File Path |
| --- | --- | --- | --- | --- | --- |
| **FR-AUTH-001** | Auth | User authentication via JWT token verification | P0 | Implemented | [`auth.js`](file:///e:/HRMS_application/backend/src/middleware/auth.js) |
| **FR-AUTH-002** | Auth | Rate limiting on authentication routes | P0 | Implemented | [`rateLimit.js`](file:///e:/HRMS_application/backend/src/middleware/rateLimit.js) |
| **FR-AUTH-003** | Auth | MFA Setup, Activation, and Verification | P1 | Implemented | [`mfaService.js`](file:///e:/HRMS_application/backend/src/services/mfaService.js) |
| **FR-EMP-001** | Employee | Employee profile creation with statutory fields | P0 | Implemented | [`employeeController.js`](file:///e:/HRMS_application/backend/src/controllers/employeeController.js#L18) |
| **FR-EMP-002** | Employee | Track employee change history logs | P1 | Implemented | [`employeeController.js`](file:///e:/HRMS_application/backend/src/controllers/employeeController.js#L43) |
| **FR-ATT-001** | Attendance | Web-based punch in/out with geolocation | P0 | Implemented | [`attendanceController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceController.js) |
| **FR-ATT-002** | Attendance | Biometric punch record sync | P0 | Implemented | [`attendanceSyncController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceSyncController.js) |
| **FR-LEAVE-001** | Leave | Leave request creation, balance checks | P0 | Broken | [`leaveController.js#L71`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L71) (Lack of balance & chronology validation) |
| **FR-PAY-001** | Payroll | Salary structure setup per employee | P0 | Implemented | [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js) |
| **FR-PAY-002** | Payroll | Statutory calculations (EPF, ESIC, PT, LWF, Gratuity) | P0 | Partially Broken | [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js) (Statutory errors on EDLI, Gratuity, and TN PT) |
| **FR-PAY-003** | Payroll | Generate monthly EPFO ECR file | P1 | Broken | [`ecrGenerator.js#L64`](file:///e:/HRMS_application/backend/src/services/ecrGenerator.js#L64) (Null DA values crash ECR generation) |
| **FR-REC-001** | Recruitment | Recruitment lifecycle (Jobs, Applicants, Interviews) | P1 | Implemented | [`recruitmentController.js`](file:///e:/HRMS_application/backend/src/controllers/recruitmentController.js) |
| **FR-REC-002** | Recruitment | Offer letter PDF generation | P1 | Implemented | [`recruitmentController.js#L180`](file:///e:/HRMS_application/backend/src/controllers/recruitmentController.js#L180) |
| **FR-FNF-001** | Exit | Exit settlement settlement calculation | P1 | Broken | [`fnfController.js#L49`](file:///e:/HRMS_application/backend/src/controllers/fnfController.js#L49) (Database update validation crash) |
| **FR-EXP-001** | Expenses | Expense claims and travel advance processing | P1 | Implemented | [`expenseController.js`](file:///e:/HRMS_application/backend/src/controllers/expenseController.js) |
| **FR-PERF-001** | Performance| Appraisals, KRAs, and 360-degree feedback reviews | P2 | Implemented | [`performanceController.js`](file:///e:/HRMS_application/backend/src/controllers/performanceController.js) |
| **FR-PROJ-001** | Projects | Project allocations, task logging, and timesheets | P2 | Implemented | [`projectController.js`](file:///e:/HRMS_application/backend/src/controllers/projectController.js) |
| **FR-COMP-001** | Compliance | Generate monthly compliance reports | P1 | Partially Broken | [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js) (Maharashtra PT slabs hardcoded for all states) |
| **FR-ANN-001** | Portal | Assets, Learning, Helpdesk modules | P2 | Database Only | [`schema.prisma#L1266`](file:///e:/HRMS_application/backend/prisma/schema.prisma#L1266) (Lack complete UI dashboard pages) |

---

## 6. Out-of-Scope Items (Potential Future Enhancements)

1. **Full-Featured Learning Management System (LMS):** Course playbacks, assessments, certifications (currently only course catalogs database exists).
2. **IT Asset Management Portal:** Physical assets barcode/serial scanning, hardware specifications tracking, repair ticket mapping (currently only simple assignments table exists).
3. **Chatbot / AI HR Assistant:** Automatic answers to leave policy queries or salary questions.
4. **Unified Approval Inbox:** Direct dashboard inbox containing approvals for leave, expense, exits, and timesheets (currently managers must visit individual pages).
5. **statutory Challan Filing Gateways:** Integrations with EPFO and ESIC API gateways to check payment success states (currently outputs raw ECR text files and Excel exports only).
