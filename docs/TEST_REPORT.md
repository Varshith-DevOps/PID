# HRMS — Test & Coverage Report

**Date:** 2026-06-27
**Scope:** Backend automated test suite (Jest + Supertest) and code-coverage analysis. Frontend status included.
**Reproduce:**
```bash
# backend/
npx jest --verbose                                  # full suite, per-test
npx jest --coverage --coverageReporters=text-summary # coverage totals
```

> **Integrity note.** This report reflects **automated** tests only. Features with a dedicated behavioural suite are marked accordingly. Features with low coverage and **no** behavioural suite are marked *Minimal / None* — they are **not** asserted to work; they simply have no automated proof. "Passes" means an assertion ran and succeeded, not "bug-free".

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Backend test suites | **29 / 29 passing** |
| Backend test cases | **207 / 207 passing** |
| Frontend test suites | **4 / 4 passing** (Vitest + RTL) |
| Frontend test cases | **41 / 41 passing** |
| Frontend E2E (Playwright/Chromium) | **4 / 4 passing** (real backend + frontend) |
| Failures / flaky | 0 |
| Backend line coverage (baseline) | 43.4% (3431 / 7911) — rising with new suites |
| Backend branch coverage (baseline) | 26.5% |

> **Progress log (2026-06-27):** Frontend test baseline established (validators + InlineField/PII-masking, 29 tests). Behavioural backend suites added for **attendance** (12 — check-in/out, replay, buddy-punch, settings RBAC, manual mark, IDOR, monthly report) and **recruitment/ATS** (11 — job CRUD+RBAC, public apply guards, stage transitions, interviews, offers+PDF, HIRED→onboarding automation). Then performance (9), shifts+overtime (12), and statutory **artefact** tests (9). The artefact pass **uncovered and fixed a real production bug**: `form16Generator` called `doc.line()` (not a pdfkit method), so Form 16 PDF generation threw `TypeError` on every call — the statutory tax certificate was non-functional and no prior test caught it. Remaining *Minimal* modules below are the next targets.

**Shape of the coverage:** testing is **deep where it matters most and risk is highest** — payroll/statutory math, authentication, authorization (RBAC), multi-tenant isolation, encryption, privacy (DPDP), and reporting. It is **thin on CRUD-heavy operational modules** (attendance, shifts, recruitment, performance, payslip PDF/email, statutory file generation). This is a defensible risk profile for the stage, but the thin areas are the next investment.

---

## 2. Coverage by functional area

Legend — **Strong**: dedicated behavioural suite + meaningful coverage. **Partial**: exercised by cross-cutting tests (e.g. RBAC) but no module-specific suite. **Minimal**: only incidentally touched; effectively unproven. **None**: no automated execution of behaviour.

| Functional area | Tests | Module line cov. | Status |
|---|---|---|---|
| Authentication, sessions, password mgmt | 14 (auth, refresh) | authController 60% | **Strong** |
| Authorization / RBAC (cross-module) | 16 (access-control) | accessControl 65% | **Strong** |
| Multi-tenant data isolation | 6 (tenant-isolation) | database.js 80% | **Strong** |
| CSRF / token revocation | 6 (csrf) | csrf middleware | **Strong** |
| Field-level encryption (PII at rest) | 7 (encryption) | encryption 90% | **Strong** |
| Log/audit redaction | 3 (redact) | redact util | **Strong** |
| Payroll calculation correctness | 15 (payroll-calc) | salaryService 81% | **Strong** |
| Indian statutory (PT/EDLI/gratuity/OT/F&F) | 7 (statutory-verify) | fnfService 100%, statutoryConstants 100% | **Strong** |
| Payroll run (E2E net pay) | 1 (payroll-run) | payrollController 45% | **Strong** (happy path) |
| Money precision | 5 (money) | money util | **Strong** |
| Leave management lifecycle | 5 (leave) | leaveController 51% | **Strong** |
| Reports / analytics / audit centre | 19 (reports) | reportController 54%, auditReportCentre 87% | **Strong** |
| Data privacy (DPDP access/erasure) | 4 (dpdp) | dpdpController 84% | **Strong** |
| Projects: costing + Jira board | 5 (project-costing) | projectController 48%, costingService 100% | **Strong** |
| Projects: sprints + burndown | 5 (sprint) | sprintController 74% | **Strong** |
| SaaS: KYC & free-trial gating | 4 (kyc-gating) | platformAdmin 47% | **Strong** |
| SaaS: sales role & custom pricing | 5 (sales-custom-pricing) | platformController 46% | **Strong** |
| Platform: policies/workflows/integrations | 2 (platform) | platformService 74% | **Partial** |
| Input validation (Zod) | 9 (validate) | validate middleware | **Strong** |
| Rule-based assistants ("AI agents") | 4 (ai-agents) | aiAgentService 70% | **Strong** (honesty/guardrails) |
| Infra: job queue, health checks | 6 (jobqueue, health) | jobQueue 59% | **Strong** |
| Timesheets | (via access-control + validate) | timesheetController 25% | **Partial** |
| Expense claims & advances | (via access-control + validate) | expenseController 17% | **Partial** |
| Assets | (via access-control) | assetController 42% | **Partial** |
| Learning / Helpdesk / Notifications | (via access-control) | 34–63% | **Partial** |
| Documents (download IDOR) | (via risk-hardening) | documentController 36% | **Partial** |
| Recruitment (openings/applicants/interviews/offers/HIRED automation) | 11 (recruitment) | recruitmentController | **Strong** ✅ new |
| Attendance (check-in/out, mark, settings, history, report) | 12 (attendance) | attendanceController | **Strong** ✅ new |
| Attendance: biometric device sync | — | attendanceSync 7% | **Minimal** |
| Attendance: regularization | — | regularizationController 6% | **Minimal** |
| Overtime requests (approve/reject/IDOR/summary) | 12 (shifts-overtime) | overtimeController | **Strong** ✅ new |
| Shift management / roster (CRUD, overlap, women-safety, reset) | 12 (shifts-overtime) | shiftController | **Strong** ✅ new |
| Performance: appraisals / KRA / 360 | 9 (performance) | performanceController | **Strong** ✅ new |
| Statutory artefacts: Form 16 PDF / ECR / ESIC / payslip PDF | 9 (artefacts) | generators | **Strong** ✅ new (found+fixed Form 16 bug) |
| Tax: TDS declarations (calc) | — | taxController 12% | **Minimal** |
| Payslip email / template selection | — | payslipController 13% | **Minimal** |
| Onboarding/offboarding checklists | — | checklistController 9% | **Minimal** |
| Utilization reports | — | utilizationController 10% | **Minimal** |
| Employee CRUD / profile | (provisioning via auth) | employeeController 20% | **Minimal** |
| MFA (TOTP) enrol/challenge/verify/recovery/disable | 5 (mfa) | mfaService | **Strong** ✅ new |
| Billing checkout/confirm (mock) | — | billingController 12% | **Minimal** |
| Company signup / onboarding | — | companyController 9% | **Minimal** |
| Frontend: validators / userMessages / InlineField / PermissionGuard | 41 (Vitest/RTL) | unit + component + RBAC gate | **Partial** ✅ new |
| Frontend E2E: login → dashboard, invalid-creds, auth redirect | 4 (Playwright) | real backend+frontend+Chromium | **Strong** ✅ new |

---

## 3. Detailed test catalogue (user-story level)

Each line is an executed, passing assertion. Read these as acceptance criteria.

### Authentication & account security — `auth.test.js` (10)
- Rejects unauthenticated self-registration
- Rejects registration from a non-admin role
- Allows admin registration and validates the role input
- Rejects password reset when caller is not admin (IDOR)
- Allows password reset when caller is admin
- Rejects an attendance punch for another employee (buddy-punching)
- Admin reset without a final password issues a strong temp password and forces change
- Newly provisioned employee account requires a password change (no static default)
- Sets an HttpOnly token cookie on successful login
- Rejects a previously valid token after logout (server-side revocation)

### Refresh-token flow — `refresh.test.js` (4)
- Login issues an HttpOnly refresh cookie scoped to `/api/auth`
- Exchanges a valid refresh token for a fresh access token
- Rejects refresh with no token
- Refresh tokens are revoked after logout (tokenVersion bump)

### CSRF protection — `csrf.test.js` (6)
- Allows safe GET without a token; exempts Bearer-auth mutations; exempts unauthenticated requests
- Rejects cookie-authenticated mutation with no CSRF token / on header-cookie mismatch
- Allows cookie-auth mutation when header matches the csrf cookie

### Authorization / RBAC — `access-control.test.js` (16)
- Profile enrichment with linked employee id; role-aware dashboards (employee/manager/admin)
- Employees create their own expense claims; blocked from finance-approving; invalid amounts rejected
- Employees blocked from reading another employee's claims / leave balance
- Timesheet ownership + hour bounds enforced; logging against another's task rejected
- Assets: admin-create, employee view-only; Learning/Helpdesk/Notifications permission integration
- Report export requires REPORTS.EXPORT

### Multi-tenant isolation — `tenant-isolation.test.js` (6)
- Hides another tenant's records on findUnique-by-id; excludes them from list queries
- Auto-populates companyId from context on create; prevents cross-tenant updateMany
- Two tenants can run payroll for the same month/year (per-tenant unique); per-tenant asset-tag scoping

### Field-level encryption — `encryption.test.js` (7)
- Round-trips; unique ciphertext per encrypt (random IV); backward-compatible plaintext passthrough
- Rejects tampered ciphertext (GCM auth tag); encrypts only configured fields; decrypts nested relations
- Prisma transparent encryption: mfaSecret stored as ciphertext, returned decrypted via app client

### Log/audit redaction — `redact.test.js` (3)
- Masks sensitive top-level + nested fields; does not mutate the original object

### Payroll calculation correctness — `payroll-calc.test.js` (15)
- EPF 12% capped at ₹15,000 (multiple bases); EPS ≤ ₹1,250 cap; PF disabled → 0
- ESI 0.75%/3.25% only when gross ≤ ₹21,000; disabled → 0
- Gross sums components; TDS new/old regime reference values; 80C effect; zero income; monotonic in income

### Indian statutory verification — `statutory-verify.test.js` (7)
- Karnataka/Tamil Nadu/other-state PT slabs; EDLI cap; gratuity (no 30-yr cap, fractional rounding)
- Overtime on ordinary wages; F&F integration (leave encashment, notice shortfall, TDS recovery)

### Payroll run E2E — `payroll-run.test.js` (1)
- Net = gross − total deductions to the paisa, with PF capped (full integration)

### Money precision — `money.test.js` (5)
- Rounds to paisa; fixes 1.005 mis-round; invalid → 0; sumMoney; mulMoney (PF 12%)

### Leave lifecycle — `leave.test.js` (5)
- Create → PENDING; approve → APPROVED; reject (with reason) → REJECTED
- Employee cannot approve (RBAC); structured balance (quota/used/remaining)

### Reports & analytics — `reports.test.js` (19)
- Role dashboards (CHRO stats; payroll masked for non-admins); dynamic query builder
- Statutory: EPF capped wages, ESI ≤ 21k restriction, gender pay gap, POSH, minimum-wage
- Compliance dashboard percentages; payroll variance
- Audit Report Centre: catalogue, metrics/risks/obligations, signed audit pack + audit logging, multi-sheet XLSX, export-permission gate
- Export: XLSX/CSV/PDF; rejects unsupported formats

### Data privacy (DPDP) — `dpdp.test.js` (4)
- Exports subject's data (right to access); blocks cross-employee export
- Anonymizes PII while retaining the row for statutory records; blocks non-admin erasure

### Projects — `project-costing.test.js` (5) + `sprint.test.js` (5)
- Costing from real per-resource rates; Jira board grouped by status; task move (status+rank); invalid status rejected; resource-rate upsert
- Sprint create; end-before-start rejected; list with task counts; burndown from completion; status → ACTIVE

### SaaS gating — `kyc-gating.test.js` (4) + `sales-custom-pricing.test.js` (5)
- PENDING KYC: attendance/leave allowed, payroll/finance blocked; super-admin KYC approval + 30-day trial; no second trial on re-approval
- SALES can fetch companies / assign custom pricing; EMPLOYEE blocked; custom features surfaced on profile

### Platform / Validation / Assistants / Infra
- `platform.test.js` (2): bootstrap policy/workflow/compliance; create legal entity/calendar/integration/workflow
- `validate.test.js` (9): login validation; **new** leave/timesheet/expense schema rejections; pagination clamps
- `ai-agents.test.js` (4): agents self-label as non-AI/advisory; Winston no fabricated evidence/no auto-approve; Athena disclaimer; Jarvis runs clean
- `jobqueue.test.js` (3) + `health.test.js` (3): inline job fallback w/o Redis; liveness/readiness/DB check

---

## 4. Gaps & risks (honest)

1. **Frontend coverage is now a baseline, not zero.** Unit (validators, userMessages), component (InlineField, PermissionGuard), and Playwright E2E (login → dashboard, auth redirect) are in place. Still uncovered: most of the 47 pages, role dashboards, the Kanban board, and payroll/payslip UIs — broaden component + E2E coverage from here.
2. **Operational CRUD modules are effectively unproven**: attendance (incl. biometric sync & regularization), shifts/roster, recruitment pipeline, performance/appraisal/360, overtime, checklists, utilization. Coverage 6–13% means only module load, not behaviour.
3. **Document-generation paths barely exercised**: payslip PDF, Form 16, ECR/ESIC file generation (3–13%). Statutory *values* are verified in `reports.test.js`, but the produced **files/formats** are not asserted.
4. **MFA flow** (TOTP enrol/verify/recovery) has no end-to-end test, only the secret-at-rest encryption test.
5. **Branch coverage 26.5%** — error/edge paths are under-tested even in covered modules.
6. **Happy-path bias** in payroll-run/E2E — failure, reversal, and concurrency paths are lightly covered.
7. **No load/performance or visual-regression tests.**

---

## 5. Non-functional coverage (where it's genuinely strong)

- **Security:** authn, RBAC, CSRF, token revocation, IDOR (payslip/leave/expense/document/cross-tenant), buddy-punching, encryption at rest, log redaction, input validation.
- **Multi-tenancy:** data-layer isolation proven generically + per-tenant uniques.
- **Statutory correctness:** PF/EPS/ESI/TDS/PT/EDLI/gratuity/OT/F&F to reference values.
- **Privacy/compliance:** DPDP access & erasure with statutory retention; audit evidence pack.

These are the highest-liability areas for an Indian HR/payroll SaaS, and they are the best-tested — the right priority.

---

## 6. Recommendations (prioritised)

1. **Add a frontend test baseline** — Vitest/RTL for critical flows (login, payroll run, payslip view, leave request) + 2–3 Playwright E2E happy paths per role.
2. **Behavioural suites for the Minimal modules**, in risk order: attendance + regularization → recruitment → performance → shifts/overtime.
3. **Assert generated artefacts**: snapshot/byte-level checks for payslip PDF, Form 16, ECR, ESIC files.
4. **MFA E2E**: enrol → verify → recovery-code → login.
5. **Negative/edge paths**: payroll reversal, double-run prevention, expired subscription mid-action, concurrency on leave/payroll.
6. ✅ **Done — coverage ratchet in CI.** `jest.config.js` enforces floors (lines 50 / stmts 48 / funcs 46 / branches 30; actuals 55/53/53/36). CI runs backend `test:coverage`, frontend Vitest, and a Playwright E2E job (`.github/workflows/ci.yml`). Raise the floors as coverage grows.
7. **Track a per-release coverage trend** so the operational modules climb over time.
