# Production Security, Safety, Abuse-Resistance, and Availability Audit

Date: 2026-06-22  
Scope: `backend`, `frontend`, `mobile_app`, deployment/config files, dependency manifests, committed local data.

## 1. Executive Summary

- Overall production readiness score: 46/100
- Security score: 42/100
- Availability/resilience score: 50/100
- Data protection score: 38/100

This application has meaningful hardening in some areas: Express security headers, CSRF protection for cookie-authenticated mutations, global and route-specific rate limits, token-version revocation, readiness probes, audit utilities, partial tenant scoping, and file upload restrictions. It is not production-ready for paying customers tomorrow because confirmed risks remain around secret exposure, browser-accessible JWTs, incomplete tenant isolation for many child models, mock/self-confirmed billing, weak seed credentials, committed uploaded resumes, and vulnerable dependencies.

Top 10 risks:

1. Committed backend `.env` contains `JWT_SECRET="supersecretjwtkey"` and `JWT_EXPIRES_IN="7d"` (`backend/.env:1-3`).
2. Frontend stores JWT in `localStorage` and writes a readable `token` cookie, defeating HttpOnly cookie protection (`frontend/src/lib/api.ts:49,64`; `frontend/src/lib/authContext.tsx:58,78`).
3. Tenant scoping is allowlisted only for selected Prisma models; many sensitive child models are not covered (`backend/src/config/database.js:30-75`; `backend/prisma/schema.prisma`).
4. Employee sub-resource mutations lack `canAccessEmployee` checks and can modify records by ID if RBAC is broad enough (`backend/src/controllers/employeeController.js:398-518,679-707,812-849`).
5. Platform admin routes allow `SALES` to update tenant status, KYC, plans, subscriptions, and metrics (`backend/src/routes/platformAdminRoutes.js:15-24`).
6. Billing uses mock checkout/confirmation controlled by authenticated client input; no provider webhook signature or payment proof (`backend/src/controllers/billingController.js:79-201`).
7. Uploaded resume PDFs are committed under `backend/uploads/resumes`, exposing candidate PII if repository becomes public.
8. Production rate limiting falls back to per-process memory; Redis packages are not installed, so horizontal scaling weakens abuse controls (`backend/src/middleware/rateLimit.js:16-32,41-51`).
9. `npm audit --omit=dev` reports high vulnerabilities in backend `multer`/`nodemailer` and frontend `axios`/`form-data`.
10. Seed credentials and demo admin accounts are committed/documented (`backend/prisma/seed.js:369-391,1079-1080`; `README-LOCAL.md:99-103`).

Top 5 fixes before production:

1. Rotate all secrets, remove committed `.env`, invalidate tokens, and enforce strong production secrets.
2. Move auth fully to HttpOnly Secure cookies or in-memory access tokens; stop writing JWTs to `localStorage` or readable cookies.
3. Close tenant/IDOR gaps: add `companyId` to tenant-owned models or enforce parent-employee/company checks on every ID route.
4. Replace mock billing confirmation with real provider checkout/webhook verification and idempotency.
5. Upgrade vulnerable packages and add CI dependency scanning gates.

## 2. Architecture Understanding

- Tech stack: Node.js 20+, Express 5, Prisma 6, Next.js 15, React 19, TypeScript, Flutter mobile app.
- Frontend: Next app in `frontend`, Axios API client, middleware only checks dashboard token expiry client-side.
- Backend: Express API in `backend/src/index.js`, route/controller structure, Prisma client extension for tenant context and field encryption.
- Database: Prisma schema defaults to SQLite (`backend/prisma/schema.prisma:5-6`); Docker compose provides local/staging PostgreSQL (`docker-compose.yml`). Production database provider cannot be verified from current code.
- Authentication: JWT access tokens plus refresh JWT cookie; access token can be sent as Bearer header or `token` cookie (`backend/src/middleware/auth.js:36`).
- Authorization: RBAC middleware, role middleware, and partial object-level checks in some controllers.
- Session/token handling: tokenVersion revocation exists (`backend/src/middleware/auth.js:52`); access TTL derives from `ACCESS_TOKEN_TTL` or `JWT_EXPIRES_IN` (`backend/src/controllers/authController.js:30`); refresh TTL default is 30 days (`authController.js:31`). Refresh rotation is sliding but not single-use.
- Storage providers: local disk uploads under `backend/uploads`; no cloud storage provider verified.
- Third-party APIs: SMTP via Nodemailer; Sentry optional; no real payment provider verified; AI routes are rule-based, not external LLM calls.
- File uploads: documents, resumes, receipts, employee photos, AI document upload.
- Queue/Redis/cache: optional Redis for rate-limit store and optional BullMQ queue; packages not installed in manifests.
- Deployment assumptions: local Docker Postgres only; no production IaC, TLS, WAF, backup, or observability config verified.
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FIELD_ENCRYPTION_KEY`, `ALLOWED_ORIGINS`, `MOBILE_APP_SECRET`, SMTP, Redis, Sentry.
- Background jobs/cron: optional job queue; no cron scheduler verified.
- Roles: `SUPER_ADMIN`, `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`, `RECRUITER`, `ONBOARDING`, `ACCOUNTS`, `FINANCE`, `PAYROLL_REVIEWER`, `PAYROLL_APPROVER`, `SALES`.
- Multi-tenancy: `companyId` on some primary models; many child models depend on parent relations and controller checks.

## 3. Critical and High Findings

### F1. Committed JWT secret and long access-token TTL

- Severity: Critical
- Evidence: `backend/.env:1-3`; `.gitignore` ignores `.env` but file is present in workspace.
- Why it matters: if this repository or deployment uses the committed secret, attackers can forge JWTs and impersonate users.
- Abuse scenario: attacker signs `{ id, role: "SUPER_ADMIN" }` with `supersecretjwtkey` and calls admin APIs.
- Recommended fix: remove `.env` from git/workspace artifacts, rotate `JWT_SECRET`, invalidate all sessions by incrementing `tokenVersion`, set `ACCESS_TOKEN_TTL=15m-30m`, store secrets only in a secret manager.
- Acceptance criteria: no real `.env` in repository; production refuses weak secrets; all existing tokens invalidated.
- Safe validation test: attempt to boot production with the weak secret and confirm startup fails; attempt old token after rotation and expect 401.

### F2. JWT stored in browser-readable locations

- Severity: Critical
- Evidence: `frontend/src/lib/api.ts:49,64`; `frontend/src/lib/authContext.tsx:58,78`; backend HttpOnly cookie exists at `backend/src/controllers/authController.js:56-64`.
- Why it matters: XSS, malicious extensions, or third-party script compromise can steal bearer tokens.
- Abuse scenario: injected JS reads `localStorage.token` and replays it from another device until expiry/revocation.
- Recommended fix: remove `localStorage` and readable `token` cookie storage. Use HttpOnly Secure SameSite cookies for refresh/access, or keep access tokens in memory only. Ensure frontend middleware does not require a JS-readable token.
- Acceptance criteria: token is absent from `localStorage` and `document.cookie`; authenticated API calls still work through HttpOnly cookies with CSRF.
- Safe validation test: log in, inspect browser storage, verify no JWT appears in localStorage or non-HttpOnly cookies.

### F3. Incomplete tenant isolation and IDOR on child models

- Severity: Critical
- Evidence: Prisma tenant allowlist at `backend/src/config/database.js:30-75`; child models such as `EmployeeAddress`, `Education`, `ProfessionalExperience`, `Document`, `BankDetails`, `PFDetails`, `Dependent`, `Attendance`, `Leave`, `PayrollRecord`, `ExpenseClaim`, etc. lack direct allowlist coverage (`backend/prisma/schema.prisma:166-1482`).
- Why it matters: a tenant boundary that relies on every controller manually joining to the parent will fail wherever a controller updates by child ID directly.
- Abuse scenario: a user with `EMPLOYEES.EDIT` changes `/employees/address/<addressId>` for another employee/tenant if they know or leak the ID.
- Recommended fix: add `companyId` to every tenant-owned model with DB constraints and RLS, or centralize object authorization helpers for every child-resource ID route. Reject all updates/deletes unless the parent employee/company belongs to `req.user.companyId`.
- Acceptance criteria: automated tests prove cross-tenant read/update/delete returns 403/404 for every model.
- Safe validation test: create two tenants in staging; attempt all child-resource ID mutations across tenants.

### F4. Employee sub-resource mutations miss object-level checks

- Severity: High
- Evidence: `employeeController` updates/deletes address, education, experience, dependent, photo, and account stage by ID without `canAccessEmployee` checks (`backend/src/controllers/employeeController.js:398-518,679-707,812-849`). Routes require broad RBAC but not target ownership (`backend/src/routes/employeeRoutes.js:133-174`).
- Why it matters: RBAC controls module permission, not the specific object being changed.
- Abuse scenario: a manager/HR user modifies another employee's dependent, education, or photo by changing an ID in the request.
- Recommended fix: fetch target record with parent employee and enforce `canAccessEmployee(req.user, employeeId)` before every mutation.
- Acceptance criteria: each sub-resource mutation has unit/integration tests for own, manager-scope, same-tenant HR, and cross-tenant denial.
- Safe validation test: replay update/delete requests with another employee's child IDs.

### F5. Platform-admin role grants are overbroad

- Severity: High
- Evidence: `router.use(authorize('SUPER_ADMIN', 'SALES'))` protects all platform-admin endpoints (`backend/src/routes/platformAdminRoutes.js:15-24`).
- Why it matters: `SALES` can change company status, KYC, custom plans, subscriptions, and see platform metrics.
- Abuse scenario: compromised sales user approves KYC, activates a free custom plan, or suspends tenants.
- Recommended fix: split read-only sales lead views from mutating platform owner actions. Require `SUPER_ADMIN` for KYC, subscription, custom plan, status, and metrics.
- Acceptance criteria: `SALES` receives 403 on all mutating `/api/platform-admin/*` routes.
- Safe validation test: login as `SALES`, attempt `PUT /companies/:id/kyc`, expect 403.

### F6. Mock/client-confirmed billing

- Severity: High
- Evidence: `checkout` creates `MOCK` transaction; `confirmPayment` trusts request `status`, `transactionId`, and `planId` (`backend/src/controllers/billingController.js:79-201`).
- Why it matters: any authenticated tenant can self-activate subscriptions without payment.
- Abuse scenario: user calls `/api/billing/checkout`, then `/api/billing/confirm-payment` with `status: "SUCCESS"` and receives active subscription.
- Recommended fix: integrate real provider checkout, confirm via signed webhook only, enforce idempotency keys, verify amount/currency/plan, and never trust client payment status.
- Acceptance criteria: no client-controlled success path exists; tests verify forged confirmation is rejected.
- Safe validation test: call confirm without provider signature and expect 401/400.

### F7. Public repository exposure of uploaded resumes and seed credentials

- Severity: High
- Evidence: committed files under `backend/uploads/resumes`; documented credentials in `README-LOCAL.md:99-103`; seed creates weak passwords (`backend/prisma/seed.js:369-391`).
- Why it matters: candidate PII and predictable demo credentials can leak.
- Abuse scenario: repository made public exposes resume PDFs and users try documented credentials against production.
- Recommended fix: purge uploaded files from repo history, move uploads to private object storage, block `backend/uploads/**`, ensure seed cannot run in production and seeded users are disabled or forced random passwords.
- Acceptance criteria: repository contains no real uploads; production seed exits unless explicit local flag is set.
- Safe validation test: secret/PII scan returns no uploaded files or passwords.

### F8. Vulnerable dependencies

- Severity: High
- Evidence: `npm audit --omit=dev` on 2026-06-22 reports backend high issues for `multer@2.1.1` and `nodemailer@6.10.1`; frontend high issues for `axios@1.15.0` and `form-data`.
- Why it matters: upload, email, and HTTP clients sit on sensitive paths and can affect availability, injection, or credential leakage.
- Recommended fix: upgrade `multer` to fixed version, `nodemailer` to fixed major, `axios` and `form-data` to fixed versions; run full tests.
- Acceptance criteria: `npm audit --omit=dev` returns zero high/critical issues in backend and frontend.
- Safe validation test: run audit in CI and fail on high/critical.

## 4. Question-by-Question Answers

Legend: P=Pass, F=Fail, Pa=Partial, CV=Cannot Verify.

### A. Tenant Isolation & Authorization

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| A1 user access other user's resources | Pa | Critical | `canAccessEmployee` exists; gaps in `employeeController` child mutations | IDOR | enforce object checks everywhere | cross-user ID tests |
| A2 all DB queries tenant scoped | F | Critical | `database.js:30-75` allowlist excludes many tenant models | cross-tenant leakage | add `companyId`/RLS or parent checks | two-tenant test suite |
| A3 object IDs guessable | Pa | Medium | Prisma IDs are strings/cuid-like; cannot verify generation for all data | leaked IDs still usable where auth missing | never rely on opacity | fuzz leaked IDs |
| A4 modify records by changing ID | F | High | `employeeController.js:398-518,679-707` | unauthorized mutations | parent ownership checks | ID tamper tests |
| A5 admin-only server protected | Pa | High | many `requireRole`; platform admin includes `SALES` | overprivilege | split roles | role matrix tests |
| A6 role checks at API | Pa | High | RBAC middleware used broadly | uneven object-level auth | combine RBAC+ABAC | route tests |
| A7 IDOR exists | F | Critical | confirmed child-resource routes | data tamper/leak | close gaps | automated IDOR suite |

### B. Authentication & Token Safety

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| B1 stolen token impact | F | Critical | bearer/localStorage token | full session takeover | HttpOnly/in-memory, MFA step-up | replay token |
| B2 token expiry short | F | High | `.env JWT_EXPIRES_IN=7d`, `authController.js:30` | long replay window | 15-30m access TTL | inspect exp |
| B3 refresh rotation | Pa | Medium | refresh slides but not single-use | stolen refresh reusable until tokenVersion changes | store hashed refresh token IDs | replay refresh |
| B4 token revocation | P | Medium | `tokenVersion` check `auth.js:52` | works on logout/password reset | keep | old token after logout |
| B5 tokens stored safely | F | Critical | frontend localStorage/readable cookie | XSS theft | remove JS storage | browser storage check |
| B6 cookie flags | Pa | Medium | backend HttpOnly/Secure/SameSite, frontend readable cookie | mixed safety | backend-only cookies | Set-Cookie inspection |
| B7 session fixation | Pa | Medium | login sets fresh token; no server refresh store | refresh replay possible | rotate refresh IDs | fixation test |
| B8 password reset | Pa | High | admin reset returns temporary password | secret exposure in response/logs | one-time reset link or force generated only | reset flow test |
| B9 email/account recovery | CV | High | no public recovery flow found | unknown | implement audited flow | staging abuse tests |
| B10 MFA for admin | Pa | High | MFA supported but not required | admin takeover impact | require MFA for privileged roles | admin login without MFA |

### C. Rate Limiting & Abuse Resistance

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| C1 10k rpm | Pa | High | global 300/min/IP; memory fallback | per-instance bypass | Redis/WAF/autoscale | load test |
| C2 login/signup/reset/forms limited | Pa | Medium | login/register/sensitive/contact/apply limiters | OTP not applicable; reset limited | add per-account limits | abuse tests |
| C3 expensive endpoints protected | Pa | High | global only for reports/payroll exports | CPU/DB exhaustion | route-specific limits/queues | export flood |
| C4 AI/API cost abuse | P/Pa | Low | rule-based AI; no external LLM verified | CPU/upload abuse only | keep limits | flood AI |
| C5 per-user/IP/route limits | Pa | Medium | mostly IP limits | NAT/shared users and per-user abuse | add authenticated user key | limiter tests |
| C6 bot/spam needed | Pa | Medium | public forms limited | no CAPTCHA/reputation | add CAPTCHA for public forms | bot submit |
| C7 one user overload shared infra | F | High | no quotas for exports/payroll/jobs | noisy neighbor | quotas and job queues | concurrent exports |

### D. Public Repository & Secret Exposure

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| D1 public repo exposure | F | Critical | `.env`, uploads, seed creds | token forgery/PII | purge/rotate | repo scan |
| D2 `.env` committed/present | F | Critical | `backend/.env` | secret leak | remove and rotate | git ls-files/status |
| D3 secrets in code | F | Critical | weak JWT secret | forged auth | secret manager | scanner |
| D4 secrets printed in logs | Pa | Medium | logger redacts metadata; many `console.error(error)` | accidental PII/secrets | route all logs through logger | forced error |
| D5 example env safe | Pa | Low | `.env.example` has blanks but `JWT_EXPIRES_IN=7d` | weak defaults | use short TTL in example | review |
| D6 build artifacts leak | Pa | Medium | `tsconfig.tsbuildinfo`, no `.next` committed | cannot fully verify sourcemaps | exclude artifacts | artifact scan |
| D7 source maps leak | CV | Medium | Next config not reviewed for prod sourcemaps | internal logic exposure | disable prod browser sourcemaps | build inspect |

### E. Input Validation & Injection

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| E1 unexpected data | Pa | High | Zod on auth/public; many controllers manual | bad state/crashes | schemas per route | fuzz tests |
| E2 request schemas | Pa | Medium | `validate.js`, limited route use | inconsistent validation | add schemas | invalid bodies |
| E3 query params | Pa | Medium | pagination helper, manual parsing | huge queries | validate query | query fuzz |
| E4 fields validated | Pa | High | PAN/Aadhaar/bank checks; many free fields | invalid business data | schema all fields | negative tests |
| E5 SQL/NoSQL injection | Pa | Medium | Prisma mostly used; raw only health | low SQLi risk | keep parameterized APIs | injection payloads |
| E6 command injection | P | Low | no `exec/spawn` in app code found | low | avoid shelling out | static scan |
| E7 SSRF | Pa | Medium | no outbound fetch except frontend route; Nodemailer audit issues | provider misuse | upgrade deps and disable URL/file access | SSRF tests |
| E8 XSS | Pa | High | React escapes; token storage worsens XSS | account takeover | CSP + no JS tokens + sanitize rich text | XSS payload |
| E9 template injection | CV | Medium | PDF/email templates not fully verified | document injection | sanitize templates | template fuzz |
| E10 error leaks | Pa | Medium | production generic, dev leaks errors | staging leakage if NODE_ENV wrong | force production env | error test |

### F. Account Compromise Impact

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| F1 normal user compromised | Pa | High | employee can access own/team depending role | personal/leave/expense abuse | least privilege + alerts | compromised-user drills |
| F2 admin compromised | F | Critical | admin can payroll/employee/billing | tenant takeover | MFA/step-up/audit | admin action tests |
| F3 export all data | Pa | High | reports/export for REPORTS.EXPORT | data exfil | scope + rate + audit | export as roles |
| F4 delete critical data | Pa | High | employee soft delete; many hard deletes child records | data loss | soft delete + recovery | delete tests |
| F5 billing/business settings | F | High | mock billing and platform routes | free service/tenant tamper | payment webhooks and role split | forged billing |
| F6 re-auth sensitive actions | F | High | password change has current password; admin/billing no step-up | privilege abuse | require recent MFA/password | stale session test |
| F7 account changes logged | Pa | Medium | change history/audit partial | gaps | central audit middleware | audit tests |
| F8 unusual activity detected | CV | High | no alerts verified | delayed incident detection | SIEM alerts | attack simulation |
| F9 owner recovery | CV | High | no recovery process verified | lockout | break-glass process | tabletop |

### G. Third-Party Package & Supply Chain

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| G1 package count | P | Low | backend 257 prod; frontend 79 prod from audit | supply chain surface | minimize | npm audit |
| G2 sensitive packages | P | Medium | JWT, Prisma, multer, nodemailer, axios, Next | auth/upload/email risk | monitor | SCA |
| G3 known vulnerable | F | High | npm audit findings | exploitable vulns | upgrade | audit zero |
| G4 unused packages | CV | Low | not fully analyzed | bloat/risk | depcheck | depcheck |
| G5 packages pinned | Pa | Medium | semver ranges in package.json, lockfiles committed | unexpected upgrades | pin or Renovate | install diff |
| G6 lock files | P | Low | package-lock files present | reproducible installs | keep | CI install |
| G7 install scripts risky | CV | Medium | not fully inspected | supply chain exec | `ignore-scripts` where possible | install audit |
| G8 maintained | Pa | Medium | some old vulnerable packages | maintenance risk | upgrade | npm outdated |
| G9 dependency scanning configured | CV | Medium | GitHub workflows not fully verified | no gate | add CI audit | PR test |
| G10 package compromise exposes data | F | High | app has env secrets + local tokens | credential/data theft | least env, no JS tokens | compromise drill |

### H. File Upload Security

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| H1 arbitrary files | Pa | High | extension/MIME filters | spoofing possible | magic-byte for all types | upload spoof |
| H2 types restricted | P | Medium | `documentRoutes.js:47-67` | reduced risk | keep | negative upload |
| H3 MIME server verified | Pa | Medium | checks client MIME; resumes have magic bytes | spoof risk | magic bytes/Tika | spoof MIME |
| H4 size limited | P | Medium | 5-10MB limits | limited DoS | keep + proxy limits | large file |
| H5 scanned/sanitized | F | High | only EICAR string for resumes | malware | AV/sandbox | EICAR and samples |
| H6 executable files | Pa | Medium | extensions block common executables | polyglots possible | content scan | polyglot |
| H7 SVG/HTML XSS | P/Pa | Medium | SVG/HTML not allowed in document route | images may contain active content elsewhere | keep denylist | SVG upload |
| H8 outside web root | P | Medium | not statically served in `index.js` | safer | private storage | direct URL |
| H9 file URLs protected | Pa | High | document download checks; committed resumes exposed | repo leak | purge uploads | download tests |
| H10 user access other files | Pa | High | documents use `canAccessEmployee`; receipts scoped | gaps possible | owner checks | cross-file tests |
| H11 path traversal | Pa | Medium | `startsWith` path checks | prefix edge cases | use path.relative check | traversal test |
| H12 image libs safe | CV | Medium | no server image processing verified | parser CVEs | avoid processing | malformed images |

### I. Redis / Cache / Queue Failure

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| I1 Redis down | Pa | High | optional; fallback memory/inline | weaker limits/sync jobs | require Redis in prod | stop Redis |
| I2 auth fail open | P | Low | auth not Redis-dependent | no fail-open | keep | Redis outage |
| I3 rate limits stop | Pa | High | memory fallback | per-instance bypass | fail closed or shared store | cluster test |
| I4 jobs lost | Pa | Medium | inline fallback if no BullMQ | request blocking | require queue | job failure |
| I5 retry logic | Pa | Medium | BullMQ attempts if enabled | inline no retry | durable queue | retry test |
| I6 graceful degradation | Pa | Medium | inline mode | slow requests | async mandatory for slow jobs | load test |
| I7 alerting | CV | High | no Redis alerts | silent degradation | alerts | outage alert |
| I8 stale cache data | CV | Medium | no cache layer verified | unknown | key by tenant | cache tests |

### J. Database Failure & Data Protection

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| J1 DB unavailable | Pa | High | readiness returns 503 | app requests fail | graceful errors | kill DB |
| J2 errors graceful | Pa | Medium | global handler; many controller catches | generic 500 | standard handler | DB fault |
| J3 app crash | Pa | Medium | unhandled rejection logged; uncaught exits | restart needed | process manager | crash test |
| J4 retries controlled | CV | Medium | Prisma default/no retries | transient failure | bounded retries | latency test |
| J5 pooling safe | CV | High | no prod DB pool config | exhaustion | pooler/config | connection test |
| J6 migrations safe | CV | High | runbook exists; no CI migration gate verified | data loss | migration checks | staging migrate |
| J7 backups | CV | Critical | no backup config | data loss | backup/PITR | restore test |
| J8 PITR | CV | Critical | not visible | unrecoverable writes | managed DB PITR | restore point |
| J9 at-rest encryption | Pa | High | field encryption optional; DB encryption CV | PII exposure | require DB + field encryption | config check |
| J10 transit encryption | CV | High | local SQLite/Postgres only | MITM | TLS DB URL | connection inspect |
| J11 destructive recoverable | Pa | High | employee soft delete, many hard deletes | data loss | soft delete critical models | delete restore |
| J12 audit critical changes | Pa | Medium | partial audit/change history | gaps | central audit | audit coverage |

### K. Third-Party API Failure

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| K1 provider errors | Pa | Medium | SMTP optional; mock billing | silent no email | provider abstraction | SMTP down |
| K2 timeouts | CV | Medium | no external HTTP timeouts found | hangs | set timeouts | fault injection |
| K3 retries bounded | Pa | Medium | queue attempts if enabled | duplicates possible | idempotency | retry tests |
| K4 circuit breaker | CV | Medium | none verified | cascading failures | breaker | provider 500 |
| K5 block whole app | Pa | Medium | email skipped if no creds; inline jobs can block | slow UX | async queue | slow SMTP |
| K6 fallback messages | Pa | Low | some generic errors | poor UX | user-safe errors | provider fail |
| K7 provider isolation | Pa | Medium | SMTP/payment mixed in controllers | blast radius | service layer | mock fail |
| K8 safe logging | Pa | Medium | logger redacts, console still used | leaks | centralized redacted logging | log scan |

### L. Monitoring, Logging & Incident Detection

| # | Status | Severity | Evidence | Risk | Fix | Test |
|---|---|---:|---|---|---|---|
| L1 know attack now | Pa | High | security events exist; alerts CV | delayed detection | SIEM alerts | attack drill |
| L2 failed logins logged | P | Medium | `AUTH_LOGIN_FAILURE` in auth controller | useful | alert thresholds | login fail |
| L3 authz failures logged | P | Medium | RBAC logs `AUTHZ_DENIED` | useful | alert | forbidden flood |
| L4 suspicious spikes | CV | High | no alert config | missed abuse | metrics/alerts | spike test |
| L5 admin actions logged | Pa | High | partial audit only | gaps | audit middleware | admin action |
| L6 payment/security events | Pa | High | auth logs; billing lacks provider audit | fraud gaps | audit billing | payment test |
| L7 structured/searchable logs | Pa | Medium | JSON in production logger | console bypasses | replace console | log format |
| L8 alerts configured | CV | High | Sentry optional, no config | no paging | alerting | alert test |
| L9 uptime monitoring | CV | High | health endpoints only | no external monitor | uptime checks | downtime test |
| L10 error tracking | CV | Medium | Sentry optional dependency not installed in package | inactive | install/configure | Sentry event |
| L11 log redaction | Pa | High | logger redacts; console errors remain | token/PII leak | all logs through redactor | secret error |

## 5. Production Failure Readiness

| Scenario | Expected behavior | Current behavior from code | Risk | Required fix | Safe test |
|---|---|---|---|---|---|
| Traffic 100x | shed load, protect DB | global IP limit, no WAF/autoscale verified | High | WAF, per-route quotas, autoscale | k6 load test |
| DB slow | timeouts, backpressure | Prisma tx timeout configured, no request timeout | High | DB pool/timeouts/circuit breaker | inject latency |
| Redis slow/down | degrade safely | memory/inline fallback | Medium/High | Redis required for prod or fail closed | stop Redis |
| Email fails | queue/retry/notify | SMTP optional, may skip sends | Medium | queue + delivery audit | bad SMTP |
| Payment fails | provider-verified state | mock billing trusted | High | real provider webhooks | forged payment |
| Storage fails | private object storage, retry | local disk only | High | object storage + backups | fill disk |
| Attacker controls input | schema reject | partial schemas | High | Zod every route | fuzz |
| Jobs stop | alert and retry | optional inline jobs | Medium | BullMQ workers + alerts | kill worker |
| Partial deploy | health gates/rollback | health exists; CI/CD CV | Medium | blue/green/rollback | failed deploy |
| Missing env vars | fail closed | production secret checks; many optionals | Medium | validate all required env | unset env |
| Concurrent updates | transactions/versioning | some transactions; no optimistic locks | Medium | idempotency/version fields | race tests |
| Restart mid-operation | idempotent recovery | transactions help; local files/jobs risk | High | durable queues/object storage | restart during upload/payroll |

## 6. Dependency & Package Review

- Backend production dependencies: 257; frontend production dependencies: 79.
- Security-sensitive packages: `jsonwebtoken`, `bcryptjs`, `@prisma/client`, `multer`, `nodemailer`, `express`, `cors`, `express-rate-limit`, `axios`, `next`, `flutter` packages.
- Confirmed vulnerable from `npm audit --omit=dev`: backend `multer`, `nodemailer`, `exceljs` via `uuid`; frontend `axios`, `form-data`, `next` via `postcss`.
- Lock files are committed for backend/frontend.
- Mobile dependency currency cannot be verified from current code because `flutter` command is unavailable.

## 7. Secrets & Public Repo Exposure Review

Confirmed exposure if repository becomes public:

- `backend/.env` with weak JWT secret and SQLite URL.
- `frontend/.env.local` with local API URL.
- Uploaded resume PDFs under `backend/uploads/resumes`.
- Seed/demo credentials in README and seed script.
- Business docs (`PRD.docx`, `TRD.docx`) may expose internal requirements. Cannot verify sensitivity from current code.

## 8. Data Access & Multi-Tenant Isolation Review

Users cannot be confirmed to access only their own data. Primary tenant models are partially scoped by Prisma extension, and some controllers use `canAccessEmployee`, but many tenant-owned child tables lack direct `companyId` and several controllers mutate by child ID without object checks. Treat tenant isolation as Partial/Fail until cross-tenant integration tests cover every route.

## 9. Availability & Abuse Resistance Review

The app has a useful baseline: global rate limit, login/register/public-form/sensitive-operation limits, upload size limits, DB readiness, graceful shutdown, and optional queue/rate-limit Redis integration. It remains vulnerable to production-scale abuse because limits are in-memory unless optional packages and Redis are added, expensive reports/exports/payroll actions lack route-specific quotas, uploads use local disk, and queues fall back to inline request processing.

## 10. Remediation Roadmap

Fix within 24 hours:

- Remove committed `.env`, rotate JWT secret, invalidate sessions.
- Remove JWT from localStorage/readable cookies.
- Disable or lock down mock billing in production.
- Remove committed uploaded resumes and block uploads from git.
- Require `SUPER_ADMIN` only for platform-admin mutations.

Fix within 3 days:

- Patch employee child-resource IDORs.
- Add route schemas for high-risk employee/payroll/billing/platform routes.
- Upgrade vulnerable backend/frontend dependencies.
- Require admin MFA and recent re-auth for privileged actions.
- Add production env validation for `FIELD_ENCRYPTION_KEY`, CORS, SMTP, Redis, DB URL.

Fix within 7 days:

- Add tenant ownership tests for every route.
- Move uploads to private object storage with malware scanning.
- Add Redis-backed rate limits and BullMQ workers as required production services.
- Add route-specific quotas for exports, payroll runs, uploads, AI-like routes.

Fix before production launch:

- Implement real payment provider webhooks and idempotency.
- Enable production observability: Sentry/APM, uptime checks, structured logs, alert rules.
- Configure backups, restore tests, PITR, DB TLS, connection pooling.
- Add CI gates for tests, audits, secret scans, dependency scans.

Fix after launch but before scale:

- Add DB-level RLS for PostgreSQL.
- Add optimistic locking/idempotency for critical financial and payroll operations.
- Add anomaly detection for auth, export, admin, billing, and payroll activity.

## 11. Engineering Backlog

1. Rotate and harden secrets
   - Priority: P0
   - Story: As an operator, production must not start with weak or committed secrets.
   - Acceptance criteria: no `.env` in repo; weak secret boot fails; old tokens invalid.
   - Files likely affected: `.gitignore`, deployment config, `backend/src/config/secrets.js`.
   - Approach: purge/rotate, secret manager, tokenVersion migration.

2. Remove browser-readable JWT storage
   - Priority: P0
   - Story: As a user, my session token must not be readable by JavaScript.
   - Acceptance criteria: no JWT in localStorage/document.cookie; auth still works.
   - Files: `frontend/src/lib/api.ts`, `frontend/src/lib/authContext.tsx`, `frontend/src/middleware.ts`, backend auth routes.
   - Approach: cookie-only auth with CSRF, or memory access token plus HttpOnly refresh.

3. Add universal tenant/object authorization
   - Priority: P0
   - Story: As a tenant, another tenant cannot read or mutate my records.
   - Acceptance criteria: cross-tenant tests fail closed for all routes.
   - Files: `backend/src/config/database.js`, controllers, Prisma schema.
   - Approach: add `companyId` to tenant models or central parent-check helpers.

4. Patch employee sub-resource IDORs
   - Priority: P0
   - Story: Users can modify only authorized employee child records.
   - Acceptance criteria: update/delete address, education, experience, dependent, photo, stage require `canAccessEmployee`.
   - Files: `backend/src/controllers/employeeController.js`.
   - Approach: fetch child with employeeId, call `canAccessEmployee`, then mutate.

5. Replace mock billing
   - Priority: P0
   - Story: Subscription activation requires verified payment.
   - Acceptance criteria: client cannot mark payment successful; signed webhook required.
   - Files: `backend/src/controllers/billingController.js`, routes, env.
   - Approach: provider checkout session, webhook signature verification, idempotency table.

6. Split platform admin permissions
   - Priority: P0
   - Story: Sales can view leads but cannot mutate tenants/subscriptions.
   - Acceptance criteria: `SALES` 403 on status/KYC/subscription/custom-plan mutation.
   - Files: `backend/src/routes/platformAdminRoutes.js`, controller tests.
   - Approach: route-specific `requireRole('SUPER_ADMIN')`.

7. Upgrade vulnerable dependencies
   - Priority: P1
   - Story: Production build has no high/critical SCA findings.
   - Acceptance criteria: `npm audit --omit=dev` clean for high/critical.
   - Files: `backend/package.json`, `frontend/package.json`, lockfiles.
   - Approach: upgrade, test, CI audit gate.

8. Move uploads to private scanned storage
   - Priority: P1
   - Story: Uploaded documents are private, scanned, and not stored in repo.
   - Acceptance criteria: private URLs, malware scan, no committed uploads.
   - Files: upload routes/controllers, deployment storage config.
   - Approach: object storage service, AV scan, signed downloads.

9. Production rate limits and queues
   - Priority: P1
   - Story: Abuse limits and slow jobs work across instances.
   - Acceptance criteria: Redis-backed rate limits, BullMQ enabled, expensive routes quotaed.
   - Files: `backend/src/middleware/rateLimit.js`, `backend/src/services/jobQueue.js`, package manifests.
   - Approach: install packages, require Redis in production, add route limiters.

10. Observability and incident detection
    - Priority: P1
    - Story: Attacks and outages page operators quickly.
    - Acceptance criteria: alerts for auth failures, 403 spikes, 5xx, queue failures, uptime.
    - Files: `backend/src/config/sentry.js`, logger, deployment.
    - Approach: install Sentry/APM, log aggregation, alert rules.

