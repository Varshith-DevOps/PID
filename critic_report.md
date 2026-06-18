# Unified Critic Report: Indian HRMS Codebase Review & Audit

This master report presents a thorough, expert-level audit of the codebase, focusing on security exposures, statutory compliance under Indian labor laws, database integrity, business logic correctness, and timezone handling.

---

## 1. Critical Security Vulnerabilities & Authorization Threats

### Bug 1: IDOR on Salary Structures (Exposing Salary Secrets to All Employees)
* **Location:** [`payrollRoutes.js`](file:///e:/HRMS_application/backend/src/routes/payrollRoutes.js#L26) & [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L1066)
* **Description:** The route `/api/payroll/structure/:employeeId` uses `rbacMiddleware('PAYROLL', 'VIEW')`. Since standard employees have the `PAYROLL.VIEW` permission enabled by default (to view their own salary history), they pass the middleware check. The controller `getSalaryStructure` then queries the requested `:employeeId` from the database directly without validating if the requester matches the employee record, or if they have Admin/HR rights.
* **Impact:** Any logged-in employee can view the basic salary, HRA, DA, PF/TDS parameters, and other fixed allowance values of *any* other employee in the organization.

### Bug 2: IDOR on Live Salary Calculations (Exposing Compensation Details)
* **Location:** [`payrollRoutes.js`](file:///e:/HRMS_application/backend/src/routes/payrollRoutes.js#L33) & [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L1088)
* **Description:** The endpoint `/api/payroll/calculate/:employeeId` computes real-time payroll breakdown metrics. Like the salary structure endpoint, it is guarded only by `rbacMiddleware('PAYROLL', 'VIEW')` which standard employees have by default. The controller does not perform any ownership or scope checks.
* **Impact:** Any authenticated user can execute real-time salary calculations for any colleague, revealing their exact net pay, bank account details, and individual deductions.

### Bug 3: IDOR on Company-Wide Timesheet Logs
* **Location:** [`timesheetRoutes.js`](file:///e:/HRMS_application/backend/src/routes/timesheetRoutes.js#L15) & [`timesheetController.js`](file:///e:/HRMS_application/backend/src/controllers/timesheetController.js#L107)
* **Description:** The `/api/timesheet/all` endpoint requires the `ATTENDANCE.VIEW` permission, which is granted to all employees by default. The controller handler `getAllTimesheets` queries all timesheet records globally. It only applies manager scope checks on daily summaries, leaving the main list completely unfiltered for standard employees.
* **Impact:** Any employee can query this endpoint to view daily hours, tasks, and task descriptions of the entire company workforce.

### Bug 4: Manager Scope Defect: Hierarchical Bypass (Skip-Level Reports)
* **Location:** [`accessControl.js`](file:///e:/HRMS_application/backend/src/services/accessControl.js#L42)
* **Description:** The manager scope resolution query (`getEmployeeScopeIds`) only fetches employees where `managerId` is the manager's direct ID. It is non-recursive.
* **Impact:** Directors, VPs, and Department Heads cannot view, approve, or manage records of their indirect subordinates (sub-teams of their direct report managers).

### Bug 5: Learning Enrollment Assignment Scope Bypass
* **Location:** [`learningController.js`](file:///e:/HRMS_application/backend/src/controllers/learningController.js#L30)
* **Description:** The `assignCourse` endpoint allows managers to assign courses by passing `employeeId` in the body. The handler does not verify if the target employee is within the manager's reporting scope.
* **Impact:** Any manager can assign courses to employees outside their department/team or modify their due dates.

### Bug 6: Public Unrestricted Resume Uploads (DoS & Malware Risk)
* **Location:** [`recruitmentRoutes.js`](file:///e:/HRMS_application/backend/src/routes/recruitmentRoutes.js)
* **Description:** The resume upload route for job applicants is public and does not check for rate-limits, file signature verification (magic bytes), or malware payloads.
* **Impact:** Attackers can upload large files to exhaust disk space or upload malicious files to compromise the server environment.

---

## 2. Statutory Compliance & Legal Violations (Indian Labor Laws)

### Bug 7: TDS Section 80C PF Deduction Inflation (Tax Under-Deduction)
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L275-L276)
* **Description:** The TDS engine projects annual PF contributions for Section 80C deductions by multiplying basic salary by 12% without checking if `restrictPfToCeiling` is enabled.
* **Impact:** For high earners, the projected PF is incorrectly inflated to the Section 80C maximum of ₹1.5 Lakhs (instead of capping at the statutory limit of ₹21,600/year). This results in an artificially lower taxable income projection and an under-deduction of monthly TDS, violating income tax guidelines.

### Bug 8: Tamil Nadu Professional Tax Monthly Deduction Ceiling Breach
* **Location:** [`statutoryConstants.js`](file:///e:/HRMS_application/backend/src/services/statutoryConstants.js#L71) & [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L140)
* **Description:** Professional Tax slabs in Tamil Nadu are semi-annual (payable twice a year). The rates in the code (up to ₹1,250) represent semi-annual liabilities. However, the system deducts this rate directly in the monthly payroll run.
* **Impact:** Over-deducts up to ₹1,250 monthly (₹15,000 annually), violating the constitutional Professional Tax ceiling of ₹2,500 per annum (Article 276(2) of the Constitution of India).

### Bug 9: Gratuity Service Years Limitation (Completed Years Cap)
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L241)
* **Description:** The Payment of Gratuity Act, 1972 imposes no limit on the number of completed service years. The codebase hardcodes completed years to a maximum of 30: `Math.min(Math.floor(yearsOfService), 30)`.
* **Impact:** Under-calculates and under-pays gratuity for employees who serve more than 30 years.

### Bug 10: Gratuity Service Period Rounding Error
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L241)
* **Description:** Section 4(2) of the Payment of Gratuity Act, 1972 requires service periods in excess of 6 months (0.5 years) to be rounded up to the next full year. The code uses `Math.floor(yearsOfService)` directly.
* **Impact:** An employee serving 5 years and 7 months is credited with only 5 years of gratuity instead of 6.

### Bug 11: EDLI Contribution Wage Ceiling Violation
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L99)
* **Description:** The Employer’s EDLI (Employees' Deposit Linked Insurance Scheme) contribution must be capped at 0.5% of the statutory wage ceiling (₹15,000). The code calculates EDLI on `pfWages`, which can be uncapped basic + DA if the employee's `restrictPfToCeiling` setting is disabled.
* **Impact:** Employers over-contribute to EDLI for high-earning employees, violating EPFO guidelines.

### Bug 12: Overtime Wage Definition Violation
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L205)
* **Description:** Section 59 of the Factories Act, 1948 mandates that overtime wages must be calculated at double the rate of "ordinary rate of wages" (Basic + DA + other fixed allowances). The controller calculates overtime pay using `basicSalary` only.
* **Impact:** Under-payment of overtime wages, risking labor law violations.

### Bug 13: TDS Future Earnings Projection for Exiting Employees
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L245)
* **Description:** During Full & Final (F&F) settlement processing, the TDS engine projects salary earnings for the remaining months of the financial year even though the employee is leaving the company.
* **Impact:** Artificially inflates the exiting employee's annual tax liability, leading to a massive and incorrect TDS deduction from their final settlement.

### Bug 14: Uncapped and Unverified Tax Declarations
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L291)
* **Description:** The `otherDeductions` field in the tax declaration is applied directly to taxable income without any capping or admin validation.
* **Impact:** Employees can input arbitrary deductions to reduce their tax liability and TDS deductions to zero.

---

## 3. Business Logic & Financial Leakage Bugs

### Bug 15: Missing Leave Balance Validation on Request/Approval
* **Location:** [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L60) & [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L109)
* **Description:** The system does not validate if an employee has sufficient leave balance before requesting or approving leave.
* **Impact:** Employees can accumulate negative leave balances without warnings, resulting in unapproved paid time off.

### Bug 16: Negative Leave Balances Bypassed in LOP Calculations
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L291)
* **Description:** The payroll run only fetches leaves where `leaveType = 'UNPAID'` for Loss of Pay (LOP) salary deductions.
* **Impact:** Employees with negative balances in SICK or CASUAL leaves (caused by Bug 15) get paid in full. These excess leaves are never docked from their salary, causing financial leakage.

### Bug 17: Sick and Casual Leave Encashment Leak
* **Location:** [`fnfService.js`](file:///e:/HRMS_application/backend/src/services/fnfService.js#L71)
* **Description:** The F&F settlement engine calculates leave encashment by summing the unused balances of all leave types (`leaveQuotas`).
* **Impact:** Standard corporate policies in India only allow Earned/Annual leaves to be encashed; Sick (SL) and Casual (CL) leaves must lapse. Encashing SL and CL leads to unnecessary payout leaks.

### Bug 18: Notice Period Recovery Math Error
* **Location:** [`fnfService.js`](file:///e:/HRMS_application/backend/src/services/fnfService.js#L94)
* **Description:** Notice period shortfall is computed as `exit.noticePeriodDays - finalMonthDaysWorked`.
* **Impact:** `finalMonthDaysWorked` represents days worked in the exit month only. If an employee has a 60-day notice period, served it in full across two months, and worked 30 days in the final month, the code calculates a 30-day notice shortfall and wrongfully recovers 30 days of salary.

---

## 4. Database Schema & API Integration Failures

### Bug 19: Non-Existent `remarks` Field in F&F Finalization
* **Location:** [`fnfController.js`](file:///e:/HRMS_application/backend/src/controllers/fnfController.js#L49)
* **Description:** The F&F finalization method executes a database update to the `ExitDetails` model containing a `remarks` key. However, the `ExitDetails` model in `schema.prisma` does not have a `remarks` field.
* **Impact:** Finalizing F&F settlements will always crash with a Prisma validation error.

### Bug 20: Reusing PF Identifier for ESIC Reports
* **Location:** [`esicReportGenerator.js`](file:///e:/HRMS_application/backend/src/services/esicReportGenerator.js#L28)
* **Description:** The database schema has no field for the ESIC IP (Insurance Person) Number. The generator reuses `emp.pfDetails?.epsNumber`.
* **Impact:** Generated ESIC reports contain invalid IP numbers, causing file upload rejections on the ESIC portal.

### Bug 21: Secret Mismatch for Biometric Punch Verification
* **Location:** [`attendanceSyncController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceSyncController.js#L22)
* **Description:** For mobile signatures, `attendanceSyncController.js` defaults the fallback secret to `'supersecret'`. However, `validateAttendancePunch` (middleware) defaults the secret to `'pid-hcms-secret-key-123'`.
* **Impact:** In the absence of an explicit `MOBILE_APP_SECRET` env variable, biometric sync punches fail signature verification.

### Bug 22: Biometric Sync Transaction Silent Commits
* **Location:** [`attendanceSyncController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceSyncController.js#L206-L238)
* **Description:** Inside the batch transaction, individual punch errors are caught and swallowed to allow processing other punches.
* **Impact:** Because errors are caught inside the transaction callback without being rethrown, the transaction executes successfully. Any partial writes made during a failed punch's processing are committed instead of rolled back.

---

## 5. Timezone & Date Processing Errors

### Bug 23: Attendance Regularization Late Minutes Timezone Mismatch
* **Location:** [`regularizationController.js`](file:///e:/HRMS_application/backend/src/controllers/regularizationController.js#L197-L200)
* **Description:** During regularization approval, the shift scheduled start time is set using local JS date functions (`scheduledTime.setHours(...)`), which run in the server's local timezone (often UTC).
* **Impact:** If the server is in UTC and the employee's shift is defined in Kolkata time (UTC+5:30), late minutes are calculated incorrectly, leading to wrong status assignments.

### Bug 24: Leave Requests Date Chronology Loophole
* **Location:** [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L71-L73)
* **Description:** `createLeaveRequest` calculates the number of days as `Math.ceil((end - start) / ...) + 1` without validating that `endDate >= startDate`.
* **Impact:** Employees can submit requests where `endDate < startDate`, resulting in a negative number of leave days that decreases their used leave balance.

### Bug 25: Overtime Detection Date Query Casting Crash
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L67)
* **Description:** The database query inside `detectAndCreateOvertime` filters by `date: { gte: new Date(date).setHours(0, 0, 0, 0) }`. `setHours` returns a raw Unix timestamp number.
* **Impact:** Prisma throws a runtime validation crash expecting a JS Date object for a DateTime field instead of an Integer.

### Bug 26: Overtime Check Future Range Matching Error
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L67)
* **Description:** The query to find existing overtime records on a given date only filters by `gte: startOfDay`.
* **Impact:** Overwrites future overtime records instead of creating a new record for the target date.

---

## 6. Calculation Errors & Data Inefficiencies

### Bug 27: Proportional Salary Gross Inflation
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L516)
* **Description:** In `calculateProportionalSalary`, the structure passed to `calculateTotalDeductions` only contains pro-rated Basic and DA. It leaves HRA and other allowances at their full monthly values.
* **Impact:** Deductions (like ESI, PT, LWF) are calculated based on an inflated monthly gross salary rather than the actual pro-rated gross, leading to over-deductions.

### Bug 28: EPFO ECR Generator Null DA Crash
* **Location:** [`ecrGenerator.js`](file:///e:/HRMS_application/backend/src/services/ecrGenerator.js#L64)
* **Description:** The ECR generator calculates `basicAndDa` as `record.basicSalary + record.da`.
* **Impact:** Since `da` is nullable in the schema, if it is null, this evaluates to `NaN`, causing ECR generation to fail.

### Bug 29: Statutory PT Compliance Report Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L170-L173)
* **Description:** The Professional Tax compliance report endpoint hardcodes Maharashtra PT slabs for all employees regardless of their actual state of employment.
* **Impact:** Generates incorrect PT compliance metrics for employees working in other states.

### Bug 30: Statutory LWF Compliance Report Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L191-L193)
* **Description:** The LWF compliance report hardcodes fixed contributions (12/36/48) for all employees, neglecting state-specific rates.
* **Impact:** Does not reflect actual state-specific LWF rates in report outputs.

### Bug 31: EPF Compliance Report Ceiling Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L134)
* **Description:** The EPF compliance report hardcodes the ₹15,000 wage ceiling limit for all calculations.
* **Impact:** Displays incorrect, capped figures for employees who have opted to contribute on actual uncapped salary.

### Bug 32: Duplicate Onboarding Account Creation Vulnerability
* **Location:** [`recruitmentController.js`](file:///e:/HRMS_application/backend/src/controllers/recruitmentController.js#L278-L295)
* **Description:** When transitioning a candidate to the "HIRED" stage, the code only checks if an employee profile exists with the candidate's email. It does not check the `User` model.
* **Impact:** If a `User` account already exists with that email (without an employee record), `prisma.user.create` throws a unique constraint error and crashes.

### Bug 33: Zero-Division Risk in Org-Chart / Demographics Reports
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L251-L253)
* **Description:** In the Gender Pay Gap compliance calculations, division is performed using `maleAvg` without checking if it is zero.
* **Impact:** If a department has female employees but no male employees, `maleAvg` is 0, causing a division by 0 and returning `NaN`.

### Bug 34: Direct Department Name Query Injection Mismatch
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L59)
* **Description:** The dynamic query builder performs filter translations by setting `where.department = { name: { equals: value } }`.
* **Impact:** In the Prisma schema, the relation name from Employee to Department is `department` (an object), but this filter structure is not standard for nested relations and leads to query errors.

### Bug 35: Lack of Transaction Isolation in Payroll Processing
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L100-L245)
* **Description:** The batch calculation of salary details and creation of payroll records is not wrapped in a single database transaction.
* **Impact:** If the server crashes mid-way, payroll records remain half-created, leaving the payroll run in an inconsistent status.

### Bug 36: Uncapped Loss-of-Pay Days Calculation
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L295)
* **Description:** The LOP calculation does not validate that the total LOP days does not exceed the total calendar days of the month.
* **Impact:** A duplicate leave entry could cause LOP days to exceed the days in the month (e.g., 32 LOP days in January), leading to a negative gross salary calculation.
