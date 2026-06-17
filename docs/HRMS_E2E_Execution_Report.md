# HRMS E2E Execution Report

## Run Summary

- Run ID: E2E-1781718581341
- Executed At: 2026-06-17T17:49:43.009Z
- Backend: http://localhost:5000/api
- Frontend: http://localhost:3000
- Total Checks: 15
- Passed: 15
- Failed: 0
- Readiness Score: 100%
- Decision: GO for covered smoke scope

## Scope Covered

- Backend health and frontend page availability
- Authentication and profile loading
- RBAC unauthorized access denial
- Employee onboarding API
- Salary structure setup
- Leave request and approval
- Attendance manual marking
- Recruitment job and applicant flow
- Project, task, timesheet, and task actual-hour rollup
- Expense claim manager and finance approval
- Payroll preflight availability
- Report export authorization
- Token tampering rejection

## Detailed Results

| ID | Module | Test | Status | Severity | Details |
| --- | --- | --- | --- | --- | --- |
| E2E-001 | Platform | Backend health check | PASS | Critical | Backend health endpoint returned OK. |
| E2E-002 | Authentication | Admin and employee login | PASS | Critical | Admin, employee, and super admin sessions established. |
| E2E-003 | Authentication | Profile includes employee scope | PASS | High | Linked employeeId returned: 13d4a87f-ac01-46d8-9c57-b00f44cfd230. |
| E2E-004 | RBAC | Employee cannot create employee profile | PASS | Critical | Unauthorized HR action blocked. |
| E2E-005 | Employee | Admin creates employee | PASS | Critical | Created employee EMP00027. |
| E2E-006 | Payroll | Salary structure setup | PASS | High | Salary structure saved for created employee. |
| E2E-007 | Leave | Employee leave request approved | PASS | Critical | Leave 36f1f307-2765-43df-bb50-0be4df52605c approved. |
| E2E-008 | Attendance | Admin marks attendance | PASS | Critical | Attendance f645b516-d88b-453c-a98d-ec7b20c097ca upserted. |
| E2E-009 | Recruitment | Job application pipeline | PASS | High | Applicant 9ef77f37-da4c-44e4-82a8-8602a1e0e51a moved to INTERVIEW. |
| E2E-010 | Projects/Timesheets | Timesheet rolls up task hours | PASS | Critical | Employee task visibility and actual-hours rollup validated. |
| E2E-011 | Expenses | Claim manager and finance approval | PASS | High | Claim e84463d6-a723-4598-bac4-1676a3efdf7f approved and marked paid. |
| E2E-012 | Payroll | Payroll preflight loads | PASS | High | Preflight returned 0 issue rows. |
| E2E-013 | Reports | Report export permissions | PASS | High | Employee blocked; admin export allowed. |
| E2E-014 | Security | Tampered token rejected | PASS | Critical | Invalid token rejected with 401. |
| E2E-015 | Frontend | Public pages HTTP smoke | PASS | Medium | Public frontend routes responded successfully. |

## Failed Items

- No failed E2E smoke checks in this run.

## Notes

- This was a non-destructive smoke run. The runner created unique E2E-1781718581341 records and attempted to remove only those records during cleanup.
- It does not replace full payroll golden-data verification, cross-browser UI automation, mobile app testing, or performance testing.
- Existing Jest regression and frontend production build should be reviewed together with this report for release readiness.
