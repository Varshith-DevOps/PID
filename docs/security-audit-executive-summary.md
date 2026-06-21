# Production-Readiness Security Audit — Executive Summary

**Application:** PID hcms (HRMS)
**Audit date:** 2026-06-21
**Scope:** Full-stack security, abuse-resistance & availability audit (backend Express + Prisma, Next.js frontend, Flutter mobile).
**Method:** Static, evidence-based review with `file:line` citations. The live app was not executed, so HTTP exploits are described as test steps; infra-only items are marked "Cannot verify."

> Full report (architecture, critical findings, question-by-question answers, failure readiness, dependency review, remediation roadmap, engineering backlog) is maintained alongside this summary. This file captures the Executive Summary only.

---

## Scorecard

| Dimension | Score | Basis |
|---|---|---|
| **Overall production readiness** | **34 / 100** | Multiple Critical issues block a paid launch |
| **Security** | **38 / 100** | Strong primitives undercut by broken tenant isolation + token-in-localStorage |
| **Availability / resilience** | **30 / 100** | SQLite in prod, no global rate limit, no graceful shutdown, no crash handlers |
| **Data protection** | **35 / 100** | DB with PII + password hashes committed to git; partial at-rest encryption; hard deletes |

This codebase is **more hardened than typical "vibe-coded" apps** (boot-time secret validation, DB-backed role/tenant claims, CSRF double-submit, real CSP, AES-256-GCM field encryption, MFA/TOTP, structured + redacted logging). But it has **launch-blocking Critical defects** in multi-tenant isolation, secret exposure, and availability. **Do not onboard paying customers until the Top 5 are fixed.**

---

## Top 10 Risks

1. **Cross-tenant IDOR / broken access control** — `services/accessControl.js:24-26` grants HR/Payroll global access with no `companyId` check; most operational models have no `companyId` at all (`config/database.js:30-43`).
2. **`backend/prisma/dev.db` committed to git** with 46 users (bcrypt hashes for `admin@hrms.com`/`superadmin@hrms.com` whose plaintext is the seeded `admin123`) and 25 employees' plaintext PAN/Aadhaar/bank/salary.
3. **SQLite as the production database** (`prisma/schema.prisma:5-8`) — single-writer file lock, no real pool, corruption-on-crash, worsened by `cluster.js`.
4. **No global rate limit; limiter store is in-memory** (`middleware/rateLimit.js:19-35`, `redis` not installed) → per-process under cluster, ~95% of routes unthrottled.
5. **JWT stored in `localStorage` + JS-readable cookie** (`frontend/src/lib/authContext.tsx:78-79`) → any XSS = full token theft, defeating the httpOnly cookie.
6. **No global `unhandledRejection`/`uncaughtException` handler and no graceful shutdown** (`config/database.js:114-120`) → crashes and killed in-flight payroll.
7. **Input validation on only 4 of ~290 routes** (`validate(` only in `authRoutes.js`/`employeeRoutes.js`); public `signup`/`contact` unvalidated.
8. **MFA never enforced** even for ADMIN/SUPER_ADMIN (`authController.js:158`); `mfaLastVerifiedAt` is written but never read.
9. **Vulnerable dependencies** — axios 1.15.0 (SSRF/proto-pollution), nodemailer 6.10.1 (SMTP injection/SSRF), multer 2.1.1 (DoS): 4 high across both apps.
10. **No optimistic locking** on leave/payroll/salary (`leaveController.js:146-157`) → lost updates / leave over-approval; plus **no audit of login or authorization failures**.

---

## Top 5 — Must Fix Before Production

1. **Tenant isolation** (Risk #1) — add `companyId` to all tenant-owned models + enforce it in `canAccessEmployee` and every `findUnique`.
2. **Purge `dev.db` from the repo + history and rotate seeded credentials** (Risk #2).
3. **Move to PostgreSQL** (Risk #3).
4. **Stop storing JWT in localStorage / JS cookie; rely on the existing httpOnly cookie + CSRF** (Risk #5).
5. **Global rate limiting on a shared store + bound the unbounded upload and pagination** (Risk #4, plus AI upload / `limit` cap).

---

## Bottom line

The foundations are unusually good for a vibe-coded app, but **four things will hurt paying customers on day one**: cross-tenant data exposure, the committed production database with working admin credentials, SQLite under real load, and token theft via XSS because the JWT lives in localStorage. Fix the Top 5 before launch; the rest fits a 3–7 day roadmap.
