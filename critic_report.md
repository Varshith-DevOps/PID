# Critic Report: Indian HRMS Codebase Review & Audit

This report presents a thorough, expert-level audit of the codebase, focusing on statutory compliance under Indian labor laws, business logic correctness, database schema integrity, security, and timezone handling. 

---

## 1. Statutory Compliance & Legal Violations (Indian Labor Laws)

### Bug 1: EDLI Contribution Wage Ceiling Violation
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L99)
* **Description:** Employees' Provident Fund (EPF) regulations state that the Employer’s EDLI (Employees' Deposit Linked Insurance Scheme) contribution must be capped at 0.5% of the statutory wage ceiling (₹15,000). In the codebase, EDLI is calculated on `pfWages`, which can be uncapped basic + DA if the employee's `restrictPfToCeiling` setting is disabled. 
* **Impact:** Employers will over-contribute to EDLI for high-earning employees, violating EPFO guidelines and leading to financial leakage.

### Bug 2: Gratuity Service Years Limitation (Completed Years Cap)
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L241)
* **Description:** The Payment of Gratuity Act, 1972 has no legal limit on the number of completed years of service for calculating gratuity. The codebase hardcodes `completedYears` to a maximum of 30: `Math.min(Math.floor(yearsOfService), 30)`.
* **Impact:** Under-calculates and under-pays gratuity for employees who serve more than 30 years, creating a severe legal violation.

### Bug 3: Gratuity Service Period Rounding Error
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L241)
* **Description:** Section 4(2) of the Payment of Gratuity Act, 1972 requires that any service period in excess of 6 months (0.5 years) must be rounded up to the next full year. The code uses `Math.floor(yearsOfService)` directly.
* **Impact:** An employee serving 5 years and 11 months will only be credited with 5 years of gratuity instead of 6, violating statutory requirements.

### Bug 4: Tamil Nadu Professional Tax Monthly Deduction Ceiling Breach
* **Location:** [`statutoryConstants.js`](file:///e:/HRMS_application/backend/src/services/statutoryConstants.js#L71) & [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L140)
* **Description:** Professional Tax slabs in Tamil Nadu are semi-annual (determined over a 6-month period). The slab rates in `statutoryConstants.js` (up to ₹1,250) represent semi-annual liabilities. However, `salaryService.js` deducts the slab rate directly in the monthly payroll run.
* **Impact:** The system will deduct up to ₹1,250 **monthly** (₹15,000 annually), which severely breaches the Constitutional Professional Tax ceiling of ₹2,500 per annum (Article 276(2) of the Constitution of India).

### Bug 5: Overtime Wage Definition Violation
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L205)
* **Description:** Section 59 of the Factories Act, 1948 mandates that overtime wages must be calculated at double the rate of "ordinary rate of wages" (Basic + DA + other fixed allowances). The controller calculates overtime pay using `basicSalary` only.
* **Impact:** Statutory under-payment of overtime wages, risking labor union disputes and legal penalties.

### Bug 6: TDS Section 80C PF Deduction Inflation
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L275-L276)
* **Description:** When projecting the annual PF contribution for Section 80C deductions, the TDS engine multiplies the full basic salary by 12% without checking if `restrictPfToCeiling` is enabled.
* **Impact:** For high earners, the projected PF is incorrectly inflated to the Section 80C maximum of ₹1.5 Lakhs, leading to an artificially lower taxable income and an under-deduction of monthly TDS.

### Bug 7: TDS Future Earnings Projection for Exiting Employees
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L245)
* **Description:** During Full & Final (F&F) settlement processing, the employee is leaving the company. However, the TDS engine still projects salary earnings for the remaining months of the financial year.
* **Impact:** Artificially inflates the exiting employee's annual tax liability, leading to a massive and incorrect TDS deduction from their final settlement.

---

## 2. Business Logic & Financial Leakage Bugs

### Bug 8: Missing Leave Balance Validation on Request/Approval
* **Location:** [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L60) & [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L109)
* **Description:** The system does not validate if an employee has sufficient leave balance before requesting or approving leave. 
* **Impact:** Employees can accumulate negative leave balances without warnings, resulting in unapproved paid time off.

### Bug 9: Negative Leave Balances Bypassed in LOP Calculations
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L291)
* **Description:** The payroll run only fetches leaves where `leaveType = 'UNPAID'` for Loss of Pay (LOP) salary deductions. 
* **Impact:** Employees with negative balances in SICK or CASUAL leaves (caused by Bug 8) get paid in full. These excess leaves are never docked from their salary, causing financial leaks.

### Bug 10: Sick and Casual Leave Encashment Leak
* **Location:** [`fnfService.js`](file:///e:/HRMS_application/backend/src/services/fnfService.js#L71)
* **Description:** The F&F settlement engine calculates leave encashment by summing the unused balances of **all** leave types (`leaveQuotas`).
* **Impact:** Standard corporate policies in India only allow Earned/Annual leaves to be encashed; Sick (SL) and Casual (CL) leaves must lapse. Encashing SL and CL leads to unnecessary payout leaks.

### Bug 11: Notice Period Recovery Math Error
* **Location:** [`fnfService.js`](file:///e:/HRMS_application/backend/src/services/fnfService.js#L94)
* **Description:** Notice period shortfall is computed as `exit.noticePeriodDays - finalMonthDaysWorked`. 
* **Impact:** `finalMonthDaysWorked` represents days worked in the exit month only. If an employee has a 60-day notice period, served it in full across two months, and worked 30 days in the final month, the code calculates a 30-day notice shortfall and wrongfully recovers 30 days of salary. Shortfall must be calculated as `noticePeriodDays` minus the days between `resignationDate` and `lastWorkingDate`.

### Bug 12: Uncapped and Unverified Tax Declarations
* **Location:** [`tdsEngine.js`](file:///e:/HRMS_application/backend/src/services/tdsEngine.js#L291)
* **Description:** Unlike 80C and 80D, the `otherDeductions` field in the tax declaration is applied directly to taxable income without any capping or admin validation.
* **Impact:** Employees can declare arbitrary deductions (e.g., ₹10 Lakhs) to instantly reduce their tax liability and TDS deductions to zero.

---

## 3. Database Schema & API Integration Failures

### Bug 13: Non-Existent `remarks` Field in F&F Finalization
* **Location:** [`fnfController.js`](file:///e:/HRMS_application/backend/src/controllers/fnfController.js#L49)
* **Description:** The F&F finalization method executes a database update to the `ExitDetails` model containing a `remarks` key. However, the `ExitDetails` model in `schema.prisma` does not have a `remarks` field.
* **Impact:** Finalizing F&F settlements will **always crash** with a Prisma validation error, blocking exits.

### Bug 14: Reusing PF Identifier for ESIC Reports
* **Location:** [`esicReportGenerator.js`](file:///e:/HRMS_application/backend/src/services/esicReportGenerator.js#L28)
* **Description:** The database schema has no field for the ESIC IP (Insurance Person) Number. The generator reuses `emp.pfDetails?.epsNumber`.
* **Impact:** EPS accounts are PF identifiers with different alphanumeric structures. The generated ESIC reports will contain invalid IP numbers, causing file upload rejections on the ESIC portal.

### Bug 15: Secret Mismatch for Biometric Punch Verification
* **Location:** [`attendanceSyncController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceSyncController.js#L22)
* **Description:** For mobile signatures, `attendanceSyncController.js` defaults the fallback secret to `'supersecret'`. However, `validateAttendancePunch` (middleware) defaults the secret to `'nexus-hrms-secret-key-123'`.
* **Impact:** In the absence of an explicit `MOBILE_APP_SECRET` env variable, biometric sync punches will fail signature checks while individual punches will pass (or vice-versa).

### Bug 16: Biometric Sync Transaction Silent Commits
* **Location:** [`attendanceSyncController.js`](file:///e:/HRMS_application/backend/src/controllers/attendanceSyncController.js#L206-L238)
* **Description:** Inside the batch transaction, individual punch errors are caught and swallowed (success/failure metrics are recorded) to allow processing other punches.
* **Impact:** Because errors are caught inside the transaction callback without being rethrown, the transaction executes successfully. Any partial writes made during a failed punch's processing are committed instead of rolled back.

---

## 4. Timezone & Date Processing Errors

### Bug 17: Attendance Regularization Late Minutes Timezone Mismatch
* **Location:** [`regularizationController.js`](file:///e:/HRMS_application/backend/src/controllers/regularizationController.js#L197-L200)
* **Description:** During regularization approval, the shift scheduled start time is set using local JS date functions (`scheduledTime.setHours(...)`), which run in the server's local timezone (often UTC).
* **Impact:** If the server is in UTC and the employee's shift is defined in Kolkata time (UTC+5:30), late minutes will be calculated incorrectly, leading to wrong status assignments (e.g., LATE instead of PRESENT).

### Bug 18: Leave Requests Date Chronology Loophole
* **Location:** [`leaveController.js`](file:///e:/HRMS_application/backend/src/controllers/leaveController.js#L71-L73)
* **Description:** `createLeaveRequest` calculates the number of days as `Math.ceil((end - start) / ...) + 1` without validating that `endDate >= startDate`.
* **Impact:** Employees can submit requests where `endDate < startDate`, resulting in a negative number of leave days. Upon approval, their used leave balance will decrease, generating "free" leave days.

### Bug 19: Overtime Detection Date Query Casting Crash
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L67)
* **Description:** The database query inside `detectAndCreateOvertime` filters by `date: { gte: new Date(date).setHours(0, 0, 0, 0) }`. `setHours` returns a raw Unix timestamp number.
* **Impact:** Prisma will throw a runtime validation crash expecting a JS Date object for a DateTime field instead of an Integer.

### Bug 20: Overtime Check Future Range Matching Error
* **Location:** [`overtimeController.js`](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L67)
* **Description:** The query to find existing overtime records on a given date only filters by `gte: startOfDay`.
* **Impact:** If an employee has overtime records on subsequent days, the query will match those future records and overwrite them instead of creating a new record for the target date.

---

## 5. Calculation Errors & Data Inefficiencies

### Bug 21: Proportional Salary Gross Inflation
* **Location:** [`salaryService.js`](file:///e:/HRMS_application/backend/src/services/salaryService.js#L516)
* **Description:** In `calculateProportionalSalary`, the structure passed to `calculateTotalDeductions` only contains pro-rated Basic and DA. It leaves HRA and other allowances at their full monthly values.
* **Impact:** Deductions (like ESI, PT, LWF) are calculated based on an inflated monthly gross salary rather than the actual pro-rated gross, leading to over-deductions.

### Bug 22: EPFO ECR Generator Null DA Crash
* **Location:** [`ecrGenerator.js`](file:///e:/HRMS_application/backend/src/services/ecrGenerator.js#L64)
* **Description:** The ECR generator calculates `basicAndDa` as `record.basicSalary + record.da`. 
* **Impact:** Since `da` is nullable in the schema, if it is null, this evaluates to `NaN`. This writes `NaN` into the generated EPFO ECR file, causing portal upload failures.

### Bug 23: Statutory PT Compliance Report Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L170-L173)
* **Description:** The Professional Tax compliance report endpoint hardcodes Maharashtra PT slabs for all employees regardless of their actual state of employment.
* **Impact:** Generates incorrect PT compliance metrics for employees working in Karnataka, Telangana, or Gujarat.

### Bug 24: Statutory LWF Compliance Report Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L191-L193)
* **Description:** The LWF compliance report hardcodes fixed contributions (12/36/48) for all employees.
* **Impact:** Does not reflect state-specific LWF rates and rules (e.g., Maharashtra or Karnataka rates) in the database.

### Bug 25: EPF Compliance Report Ceiling Hardcoding
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L134)
* **Description:** The EPF compliance report hardcodes the ₹15,000 wage ceiling limit for all calculations.
* **Impact:** Displays incorrect, capped figures for employees who have opted to contribute on actual uncapped salary.

### Bug 26: Duplicate Onboarding Account Creation Vulnerability
* **Location:** [`recruitmentController.js`](file:///e:/HRMS_application/backend/src/controllers/recruitmentController.js#L278-L295)
* **Description:** When transitioning a candidate to the "HIRED" stage, the code only checks if an *employee* profile exists with the candidate's email. It does not check the `User` model.
* **Impact:** If a `User` account already exists with that email (without an employee record), `prisma.user.create` will throw a unique constraint error and crash the entire request, blocking candidate hiring.

### Bug 27: Zero-Division Risk in Org-Chart / Demographics Reports
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L251-L253)
* **Description:** In the Gender Pay Gap compliance calculations, division is performed using `maleAvg` without checking if it is zero.
* **Impact:** If a department has female employees but no male employees, `maleAvg` will be 0, causing `gap` to divide by 0 and return `NaN`, messing up the report output.

### Bug 28: Direct Department Name Query Injection Mismatch
* **Location:** [`reportController.js`](file:///e:/HRMS_application/backend/src/controllers/reportController.js#L59)
* **Description:** The dynamic query builder performs filter translations by setting `where.department = { name: { equals: value } }`.
* **Impact:** In the Prisma schema, the relation name from Employee to Department is `department` (which is an object), but this filter structure is not standard for nested relations and can lead to runtime prisma query errors.

### Bug 29: Lack of Transaction Isolation in Payroll Processing
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L100-L245)
* **Description:** The batch calculation of salary details and creation of payroll records is not wrapped in a single database transaction.
* **Impact:** If the server crashes mid-way during a massive payroll run, the run status remains in-progress or half-completed, requiring manual database cleanup.

### Bug 30: Uncapped Loss-of-Pay Days Calculation
* **Location:** [`payrollController.js`](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L295)
* **Description:** The LOP calculation does not validate that the total LOP days does not exceed the total calendar days of the month.
* **Impact:** A misconfigured or duplicate leave entry could cause LOP days to exceed the days in the month (e.g., 32 LOP days in January), leading to a negative gross salary calculation.
