# HRMS Payroll Module — Comprehensive Audit & Compliance Report

**Date:** May 31, 2026  
**Auditor:** Senior QA Auditor & Payroll Compliance Expert (Indian Statutory & Labor Laws)  
**Target System:** HRMS Application running locally at `http://localhost:3000/`  
**Verdict:** 🛑 **CRITICAL COMPLIANCE & SECURITY RISK.** The system contains several major statutory calculation errors, a severe parameter-passing bug in the Provident Fund calculation, critical security vulnerabilities (BOLA/IDOR) leaking salary and payslip history of all employees, and several integration gaps between attendance/timesheets and overtime pay.

---

## 1. Executive Summary

A deep architectural and statutory compliance audit of the HRMS application was conducted, focusing on the core files [payrollController.js](file:///e:/HRMS_application/backend/src/controllers/payrollController.js), [salaryService.js](file:///e:/HRMS_application/backend/src/services/salaryService.js), [overtimeController.js](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js), and [payslipController.js](file:///e:/HRMS_application/backend/src/controllers/payslipController.js). 

While the system has a sleek UI/UX layout and supports advanced payroll runs with manual staging checks, the underlying calculations and authorization boundaries suffer from severe issues that expose the organization to **financial leakage**, **labor law lawsuits**, **tax penalty liabilities under the Income Tax Act**, and **data privacy breaches (DPDP Act 2023)**.

### Primary Audit Highlights:
*   **Provident Fund Bug:** A critical function parameter mismatch causes employee PF to be calculated even when disabled, and coerces a boolean into a dearness allowance amount.
*   **Security Vulnerability (IDOR/BOLA):** Any regular authenticated employee can fetch, view, and download the full payslip history and salary breakup of *any* employee (including the CEO) by omitting or altering the `employeeId` query parameter or directly calling the PDF retrieval endpoint.
*   **Gratuity Calculations:** Underpays employees by using an incorrect divisor (365 calendar days instead of the statutory 26 working days), ignores Dearness Allowance (DA), and pays out after 1 year of service instead of the statutory 5-year threshold.
*   **Overtime Detection Logic:** Uses a monthly standard threshold (176 hours) against daily hours worked, resulting in negative overtime hours; thus, overtime is never automatically detected.
*   **TDS Tax Projection Bug:** Projects a monthly bonus or incentive across 12 months, causing massive, incorrect tax withholding spikes for a single month's payout.

---

## 2. Risk Severity Matrix

| ID | Issue Title | Module | Severity | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Broken Object Level Authorization (IDOR) on Payslips | Security & Access | 🔴 **Critical** | Leaks private salary details organization-wide. |
| **CAL-01** | PF Parameter Mismatch & Type Coercion Bug | PF Calculation | 🔴 **Critical** | Direct financial deduction error; ignores employee opt-out. |
| **CMP-01** | Invalid Gratuity Divisor, DA Omission & Eligibility | Gratuity Compliance | 🟠 **High** | Underpayment of statutory gratuity; violates Gratuity Act 1972. |
| **CMP-02** | ESI Mid-Cycle Ceiling & Contribution Cycle Violations | ESI Compliance | 🟠 **High** | Statutory non-compliance with ESI Act contribution periods. |
| **CMP-03** | Flat-rate Hardcoded Professional Tax Slabs | PT Compliance | 🟡 **Medium** | Violates state-specific PT laws for multi-state employers. |
| **CMP-04** | No Support for Old Tax Regime or Tax Deductions | TDS / Income Tax | 🟠 **High** | Tax under/over-withholding; violates Income Tax Act. |
| **BUG-01** | Overtime Automated Daily Detection Logic Failure | Overtime Integration | 🟠 **High** | Underpays employees; violates Shops & Establishment Acts. |
| **BUG-02** | Zero Attendance Fallback Pays Full Salary | Attendance Integration| 🟠 **High** | Direct financial leakage (paying employees for zero work). |
| **BUG-03** | Working Days Mismatch (Hardcoded 20 vs. Dynamic Month) | Salary Preview | 🟡 **Medium** | Discrepancy between salary preview and actual payroll run. |
| **WKF-01** | Missing Maker-Checker Flow & Safe Reversal | Workflow | 🟡 **Medium** | Auditing and operational control weakness. |

---

## 3. Critical Issues & Security Vulnerabilities

### [SEC-01] IDOR / BOLA on Payslips and History Retrieval
*   **Module Name:** Security & Access Control / Payslip Module
*   **Location:** [payslipRoutes.js](file:///e:/HRMS_application/backend/src/routes/payslipRoutes.js#L14-L16) and [payslipController.js](file:///e:/HRMS_application/backend/src/controllers/payslipController.js#L24-L95)
*   **Severity:** 🔴 **Critical**
*   **Steps to Reproduce:**
    1. Log in as a standard regular employee (e.g., `employee@hrms.com`).
    2. Make a `GET` request to `/api/payslip/history` without passing an `employeeId` query parameter, or pass another employee's ID.
    3. Make a `GET` request to `/api/payslip/pdf/:id` using another employee's payslip ID.
*   **Expected Behavior:** The backend must validate that the logged-in user (`req.user.id`) matches the employee ID associated with the payslip record, or that the user has the administrative role (`SUPER_ADMIN` or `ADMIN`).
*   **Actual Behavior:** The endpoints are only protected by the generic `authenticate` middleware. No check exists inside `getPayslipHistory`, `getPayslip`, or `downloadPayslipPDF` to verify the ownership of the records. A regular employee can access the history of *all* employees or download any employee's payslip.
*   **Suggested Fix:** Add a verification check in [payslipController.js](file:///e:/HRMS_application/backend/src/controllers/payslipController.js) to enforce that an employee can only query their own ID:
    ```javascript
    if (req.user.role === 'EMPLOYEE' && employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "Access denied. You cannot view other employees' records." });
    }
    ```

### [CAL-01] Critical PF Parameter Mismatch & Type Coercion Bug
*   **Module Name:** Provident Fund (PF) Calculation
*   **Location:** [payrollController.js:L55](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L55) and [salaryService.js:L68](file:///e:/HRMS_application/backend/src/services/salaryService.js#L68)
*   **Severity:** 🔴 **Critical**
*   **Steps to Reproduce:**
    1. Configure an employee's `SalaryStructure` with `pfEnabled = false`.
    2. Run or preview the salary structure through the `/api/payroll/structure/:employeeId` route.
*   **Expected Behavior:** The employee PF contribution must return 0 because `pfEnabled` is `false`.
*   **Actual Behavior:** 
    *   In `payrollController.js` (line 55): `const pf = salaryCalculator.calculatePF(structure.basicSalary, structure.pfEnabled);`
    *   In `salaryService.js` (line 68): `calculatePF(basicSalary, da = 0, employeeContribution = true)`
    *   Due to the parameter mismatch, `pfEnabled` (a boolean) is passed as `da`, so the formula evaluates `basicSalary + pfEnabled` (which coerces `false` to `0` or `true` to `1`).
    *   The `employeeContribution` parameter remains `undefined` (defaulting to `true`). Hence, PF continues to be deducted even if `pfEnabled` is set to `false`.
*   **Suggested Fix:** Align the arguments of the function call in `payrollController.js` with the signature of `calculatePF` in `salaryService.js`:
    ```javascript
    const pf = salaryCalculator.calculatePF(structure.basicSalary, structure.da || 0, structure.pfEnabled);
    ```

---

## 4. Indian Payroll Statutory Compliance Gaps

### [CMP-01] Invalid Gratuity Divisor, DA Omission & Eligibility Threshold
*   **Module Name:** Statutory Compliance / Gratuity
*   **Location:** [salaryService.js:L105-L113](file:///e:/HRMS_application/backend/src/services/salaryService.js#L105-L113)
*   **Severity:** 🟠 **High**
*   **Expected Behavior (Payment of Gratuity Act, 1972):**
    1. **Eligibility:** Gratuity is only payable after **5 years** of continuous service (except in cases of death/disablement).
    2. **Divisor:** Daily wage must be calculated by dividing monthly wages by **26** working days, not calendar days.
    3. **Wage Definition:** Wages for gratuity must include **Basic + DA** (Dearness Allowance).
*   **Actual Behavior:**
    1. Eligibility is set to 1 year (`if (yearsOfService < 1) return 0;`).
    2. Daily wage divisor is calendar-based: `const dailyWages = (basicSalary * 12) / 365;` (which is dividing by ~30.41). This heavily underpays the employee.
    3. Dearness Allowance (`da`) is completely omitted from the calculation.
*   **Suggested Fix:** Rewrite the `calculateGratuity` function in `salaryService.js`:
    ```javascript
    calculateGratuity(basicSalary, da = 0, yearsOfService) {
      if (yearsOfService < 5) return 0;
      const completedYears = Math.floor(yearsOfService);
      const monthlyWages = basicSalary + da;
      const gratuity = (monthlyWages / 26) * 15 * completedYears;
      return Math.round(gratuity * 100) / 100;
    }
    ```

### [CMP-02] ESI Mid-Cycle Ceiling & Contribution Cycle Violations
*   **Module Name:** Statutory Compliance / Employee State Insurance (ESI)
*   **Location:** [salaryService.js:L84-L96](file:///e:/HRMS_application/backend/src/services/salaryService.js#L84-L96)
*   **Severity:** 🟠 **High**
*   **Expected Behavior (ESI Act):**
    *   ESI contribution periods are fixed six-month windows: **April to September** and **October to March**.
    *   If an employee's gross monthly wage is under the ₹21,000 ceiling at the start of the window and exceeds it mid-cycle, **they must continue to pay ESI contributions until the end of that contribution period**.
*   **Actual Behavior:** The `calculateESI` function instantly cuts off ESI calculations in the very month the employee's `grossEarnings` exceeds `esiGrossCeiling` (₹21,000), violating ESI contribution persistence rules.
*   **Suggested Fix:** Store and query the employee's ESI contribution eligibility flag at the start of the current ESI cycle, and continue calculations until the end of September or March.

### [CMP-03] Flat-rate Hardcoded Professional Tax (PT) Slabs
*   **Module Name:** Statutory Compliance / Professional Tax
*   **Location:** [salaryService.js:L98-L103](file:///e:/HRMS_application/backend/src/services/salaryService.js#L98-L103)
*   **Severity:** 🟡 **Medium**
*   **Expected Behavior:** Professional Tax is a state-specific progressive tax. Different states have completely different slabs, gender exemptions (e.g., female exemptions in Maharashtra), and monthly/yearly variations (e.g., February Maharashtra PT is ₹300).
*   **Actual Behavior:** The system hardcodes a flat ₹200 for gross earnings above ₹25,000, and ₹0 otherwise. This is highly non-compliant for multi-state or multi-location companies.
*   **Suggested Fix:** Implement a state-based configuration model in the database or service. For example, for Maharashtra:
    ```javascript
    calculatePT(grossEarnings, state = 'Maharashtra', gender = 'Male', month = 4) {
      if (grossEarnings <= 7500) return 0;
      if (state === 'Maharashtra') {
        if (gender === 'Female' && grossEarnings <= 25000) return 0;
        if (grossEarnings > 7500 && grossEarnings <= 10000) return 175;
        if (grossEarnings > 10000) {
          return month === 2 ? 300 : 200; // February anomaly
        }
      }
      return 200; // Default fallback
    }
    ```

### [CMP-04] No Support for Old Tax Regime, Tax Projections & 80C/80D/HRA Deductions
*   **Module Name:** Taxation / TDS Calculation
*   **Location:** [salaryService.js:L115-L146](file:///e:/HRMS_application/backend/src/services/salaryService.js#L115-L146)
*   **Severity:** 🟠 **High**
*   **Expected Behavior:**
    1. Employees must be allowed to choose between the **Old Tax Regime** and the **New Tax Regime** (Section 115BAC).
    2. If on the Old Regime, TDS calculations must incorporate investment declarations under **80C, 80D, 24(b) (Home Loan Interest), and HRA Exemption (Section 10(13A))**.
    3. One-off monthly payments (like an annual performance bonus) must not be projected across 12 months as recurring monthly income.
*   **Actual Behavior:**
    1. Only the New Tax Regime is supported, with a flat ₹75,000 standard deduction.
    2. Although checkboxes exist during preflight for "declarations and proofs verified," the TDS calculation logic completely ignores them. No fields are available in `SalaryStructure` to record these deductions.
    3. The formula `const annualGross = monthlyGross * 12;` incorrectly projects one-time variable bonuses, causing massive incorrect tax spikes.
*   **Suggested Fix:** Incorporate the tax regime selection in `SalaryStructure`. Capture investment declarations and use them to calculate the tax projections dynamically over the remaining months of the fiscal year rather than multiplying the current month's gross by 12.

### [CMP-05] Missing Employer PF Split (EPF vs. EPS) & Admin Charges
*   **Module Name:** Statutory Compliance / PF
*   **Location:** [salaryService.js:L68-L82](file:///e:/HRMS_application/backend/src/services/salaryService.js#L68-L82)
*   **Severity:** 🟡 **Medium**
*   **Expected Behavior:** Under the EPF Act, the employer's 12% contribution is split: **8.33% goes to the Pension Scheme (EPS)** capped at ₹15,000 wages (max ₹1,250), and the remaining **3.67% goes to the Provident Fund (EPF)**. The employer must also pay 0.5% EPF Admin Charges and 0.5% EDLI charges.
*   **Actual Behavior:** The system lumps the entire 12% into `employerPf` without splitting it or tracking the admin charges, making statutory ECR returns generation impossible.
*   **Suggested Fix:** Perform the statutory 8.33% / 3.67% split inside the PF calculation and add EDLI and Admin charge tracking.

---

## 5. Functional & Integration Bugs

### [BUG-01] Overtime Automated Daily Detection Logic Failure
*   **Module Name:** Overtime & Attendance Integration
*   **Location:** [overtimeController.js:L18-L24](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js#L18-L24)
*   **Severity:** 🟠 **High**
*   **Steps to Reproduce:** An employee logs a daily work entry of 10 hours in their timesheet.
*   **Expected Behavior:** Overtime is calculated based on hours worked beyond a standard daily shift (e.g., 8 hours). Thus, the overtime hours for that day should be `10 - 8 = 2` hours.
*   **Actual Behavior:** 
    ```javascript
    const otHours = hoursWorked - settings.standardHours;
    ```
    Since `settings.standardHours` represents the standard *monthly* working hours (defaults to `176`), the daily formula computes `10 - 176 = -166`. Because `-166 <= 0`, it returns `null`. **Overtime is never automatically detected.**
*   **Suggested Fix:** Update the calculation in `overtimeController.js` to compare daily hours worked with the standard daily shift (e.g., 8 hours):
    ```javascript
    const dailyStandard = 8;
    const otHours = hoursWorked - dailyStandard;
    ```

### [BUG-02] Zero Attendance Fallback Pays Full Monthly Salary (Financial Leakage)
*   **Module Name:** Attendance & Payroll Integration
*   **Location:** [payrollController.js:L257](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L257)
*   **Severity:** 🟠 **High**
*   **Expected Behavior:** If an employee has zero recorded attendance entries, and they are not on approved paid leaves, their payable days should be 0.
*   **Actual Behavior:** The line:
    ```javascript
    const payableDays = Math.max(0, Math.min(workDays, daysWorked || workDays) - unpaidLeaves);
    ```
    evaluates to `workDays` when `daysWorked` is `0` (using the logical OR fallback `daysWorked || workDays`). An employee with zero attendance entries receives their full salary, creating a massive financial leakage risk.
*   **Suggested Fix:** Treat zero attendance as zero payable days, unless an approved leave is present, rather than falling back to the full month:
    ```javascript
    const payableDays = Math.max(0, daysWorked - unpaidLeaves);
    ```

### [BUG-03] Working Days Mismatch (Hardcoded 20 vs. Dynamic Month)
*   **Module Name:** Salary Calculation Preview / API
*   **Location:** [payrollController.js:L472](file:///e:/HRMS_application/backend/src/controllers/payrollController.js#L472)
*   **Severity:** 🟡 **Medium**
*   **Expected Behavior:** The individual employee salary preview calculation must use the same working day basis as the monthly payroll run.
*   **Actual Behavior:** In the individual preview route (`calculateEmployeeSalary`), the `workDays` is hardcoded to `20`. In the main monthly run (`runPayroll`), it is dynamically calculated using calendar days in the month (e.g., 30 or 31). This causes a substantial difference in LOP and proportional payouts between what the employee previews and what is processed.
*   **Suggested Fix:** Change the hardcoded `20` in `calculateEmployeeSalary` to use the dynamic calendar days or dynamic standard workdays configured in the payroll settings.

---

## 6. Workflow & UI/UX Issues

### [WKF-01] Lack of Maker-Checker Roles and Non-Reversible Payroll
*   **Module Name:** Payroll Processing Workflow
*   **Severity:** 🟡 **Medium**
*   **Audit Observation:**
    *   There is no segregation of duties (Maker-Checker control). Any user with an Admin role can create, execute, and finalize the payroll. In standard corporate compliance, one role (HR Processor) compiles and calculates payroll, while a separate role (Finance Manager/CFO) audits and approves the payout.
    *   Once a payroll run is processed (`status: 'PROCESSED'`), there is no mechanism to reverse, roll back, or mark it as draft to make corrections. If an error is caught post-run, the database must be manually edited.
*   **Recommendations:** 
    *   Introduce a two-step approval flow: `DRAFT` ➔ `PENDING_APPROVAL` ➔ `APPROVED` ➔ `PROCESSED`.
    *   Implement a "Rollback/Reverse Payroll" action for admins, which deletes the records and resets the status of the payroll run safely.

### [UI-01] Missing Investment Declaration Portal
*   **Module Name:** Employee Self-Service (ESS)
*   **Severity:** 🟡 **Medium**
*   **Audit Observation:** The frontend has a section for checking that investment proofs are completed, but provides no UI or page for employees to submit their investment declarations (Form 12BB), declare rent paid, or upload proof documents.
*   **Recommendations:** Add an "Income Tax Planner" tab under the Employee dashboard allowing them to select their Tax Regime, enter Section 80C/80D amounts, and upload HRA rent receipts.

---

## 7. Recommendations & Action Plan

1.  **Deploy Immediately (Critical Hotfixes):**
    *   Fix the **PF Parameter Mismatch** in [payrollController.js](file:///e:/HRMS_application/backend/src/controllers/payrollController.js) (Line 55) to prevent incorrect deductions.
    *   Enforce **BOLA/IDOR checks** in the `/history` and `/pdf/:id` endpoints inside [payslipRoutes.js](file:///e:/HRMS_application/backend/src/routes/payslipRoutes.js) to protect employee salary confidentiality.
    *   Fix the **Overtime Detection daily threshold** formula in [overtimeController.js](file:///e:/HRMS_application/backend/src/controllers/overtimeController.js) so overtime hours compile correctly.
2.  **Statutory Compliance Fixes:**
    *   Refactor the **Gratuity calculation** in `salaryService.js` to divisor 26, include DA, and establish the 5-year eligibility threshold.
    *   Implement **Professional Tax state configurations** instead of the flat ₹200 rule.
    *   Implement ESI cycle tracking (6-month rule).
3.  **Enhance Security & Auditing:**
    *   Introduce an **Audit Log model** that logs whenever a salary structure is created/edited, or whenever payroll is executed (Maker-Checker actions).
4.  **Database Migration:**
    *   Migrate from SQLite to **PostgreSQL** for production environments to handle concurrent transactions and row-level locking during complex payroll operations.

---

## 8. Test Coverage Summary

| Module | Test Case Description | Type | Result |
| :--- | :--- | :--- | :--- |
| **Security** | Access other employee payslip via IDOR | Negative | ❌ **FAILED** (Allowed access) |
| **Security** | Access history of other employee | Negative | ❌ **FAILED** (Allowed access) |
| **PF** | Calculate PF when pfEnabled = false | Negative | ❌ **FAILED** (Calculated anyways) |
| **Gratuity** | Calculate Gratuity under 5 years of service | Statutory | ❌ **FAILED** (Allowed at 1 year) |
| **Gratuity** | Calculate Gratuity wage divisor rate | Mathematical | ❌ **FAILED** (Used calendar 365 instead of working 26) |
| **Overtime** | Detect overtime for 10-hour work day | Functional | ❌ **FAILED** (Resulted in negative overtime) |
| **Attendance** | Process payroll for employee with zero check-ins | Edge Case | ❌ **FAILED** (Paid full monthly salary) |
| **TDS** | Project TDS with standard deduction | Mathematical |  **PASSED** |
