# HRMS Application — Version & Technology Audit

> **Audit Date:** May 30, 2026
> **Verdict:** ⚠️ Most dependencies are significantly outdated and some have known security vulnerabilities.

---

## Frontend (`frontend/package.json`)

| Package | Your Version | Latest Version | Status | Severity |
|---|---|---|---|---|
| **Next.js** | `14.1.0` | `16.2.6` | ❌ **2 major versions behind** | 🔴 Critical — has known security vulnerabilities (DoS, SSRF, XSS). Next.js 14.1.0 is EOL. |
| **React** | `^18.2.0` | `19.2.6` | ❌ **1 major version behind** | 🟡 Moderate — React 19 introduces Server Components, Actions, and new hooks. |
| **React DOM** | `^18.2.0` | `19.2.6` | ❌ **1 major version behind** | 🟡 Moderate — must match React version. |
| **Axios** | `^1.6.7` | `~1.9.x` | ⚠️ Minor behind | 🟢 Low — minor/patch updates. |
| **Recharts** | `^2.12.0` | `~2.15.x` | ⚠️ Minor behind | 🟢 Low — minor feature updates. |
| **TypeScript** | `^5.3.3` | `6.0.3` | ❌ **1 major version behind** | 🟡 Moderate — TypeScript 6 has significant type-system improvements. |
| **@types/react** | `^18.2.52` | `19.x` | ❌ Major mismatch | 🟡 Moderate — should match React major version. |
| **@types/node** | `^20.11.16` | `22.x` | ⚠️ Behind | 🟢 Low |

---

## Backend (`backend/package.json`)

| Package | Your Version | Latest Version | Status | Severity |
|---|---|---|---|---|
| **Express.js** | `^4.18.3` | `5.2.1` | ❌ **1 major version behind** | 🟡 Moderate — Express 4 is in maintenance mode. Express 5 is recommended for all new projects. |
| **Prisma ORM** | `^5.10.0` | `7.8.0` | ❌ **2 major versions behind** | 🔴 Critical — Prisma 7 has major performance, type-safety, and schema improvements. |
| **@prisma/client** | `^5.10.0` | `7.8.0` | ❌ **2 major versions behind** | 🔴 Critical — must match Prisma CLI version. |
| **Multer** | `^1.4.5-lts.1` | `2.1.1` | ❌ **1 major version behind** | 🔴 **Critical Security** — Multer 1.x has multiple CVEs (DoS, memory leaks). Upgrade to 2.1.1 immediately. |
| **jsonwebtoken** | `^9.0.2` | `9.0.3` | ⚠️ Patch behind | 🟢 Low — minor patch. |
| **bcryptjs** | `^2.4.3` | `2.4.3` | ✅ Current | 🟢 None |
| **cors** | `^2.8.5` | `2.8.5` | ✅ Current | 🟢 None |
| **dotenv** | `^16.4.5` | `~16.5.x` | ⚠️ Minor behind | 🟢 Low |
| **nodemailer** | `^6.9.9` | `~6.10.x` | ⚠️ Minor behind | 🟢 Low |
| **pdfkit** | `^0.14.0` | `~0.16.x` | ⚠️ Minor behind | 🟢 Low |
| **zod** | `^3.22.4` | `~3.25.x` | ⚠️ Minor behind | 🟢 Low |

---

## Database & Schema

| Aspect | Current State | Recommendation | Severity |
|---|---|---|---|
| **Database Engine** | SQLite (`file:./dev.db`) | Fine for development. For production, migrate to **PostgreSQL 16+** or **MySQL 8+**. SQLite has no concurrency support for multi-user HRMS. | 🔴 Critical for production |
| **Prisma Schema Syntax** | Prisma v5 syntax | Prisma 7 introduced improved relation modes, composite types, and enhanced `@@index` options. Schema should be reviewed after upgrade. | 🟡 Moderate |
| **Migration Strategy** | Using `prisma db push` | For production, switch to `prisma migrate dev` / `prisma migrate deploy` for versioned, auditable migrations. | 🟡 Moderate |

---

## Configuration & Tooling

| Aspect | Current State | Recommendation | Severity |
|---|---|---|---|
| **Next.js Config** | CommonJS (`module.exports`) | Next.js 15+ uses `next.config.ts` or ESM (`export default`). Migrate config format. | 🟡 Moderate |
| **Dev Server** | `node src/index.js` (no hot-reload) | Use **nodemon** or **tsx watch** for backend hot-reloading during development. | 🟢 Low |
| **Node.js Engine** | Not specified in `package.json` | Add `"engines": { "node": ">=20" }` to both packages. | 🟢 Low |
| **Linting/Formatting** | None configured for backend | Add **ESLint** and **Prettier** for consistent code quality. | 🟡 Moderate |

---

## Security Concerns (Immediate Action Required)

> [!CAUTION]
> The following packages have **known security vulnerabilities** and should be upgraded immediately:

1. **Next.js 14.1.0** — Multiple CVEs: DoS, middleware bypass, SSRF, and XSS vulnerabilities.
2. **Multer 1.4.5-lts.1** — Multiple CVEs (2025–2026): memory leaks, uncontrolled recursion, and DoS attacks via malformed requests.
3. **Prisma 5.x** — End-of-life; no longer receiving security patches.

---

## Summary of Recommended Upgrade Path

### Phase 1 — Critical Security Fixes (Do Immediately)
```
# Backend
npm install multer@^2.1.1
npm install prisma@^7.8.0 @prisma/client@^7.8.0

# Frontend  
npm install next@^16.2.6 react@^19.2.6 react-dom@^19.2.6
```

### Phase 2 — Framework Modernization
- Migrate Express 4 → Express 5
- Migrate TypeScript 5 → TypeScript 6
- Update `@types/react` to v19
- Convert `next.config.js` to `next.config.ts`

### Phase 3 — Production Readiness
- Swap SQLite for PostgreSQL
- Switch from `prisma db push` to proper migrations
- Add ESLint, Prettier, and pre-commit hooks
- Add `engines` field to `package.json`
- Add backend hot-reloading with nodemon
