# NexusHR HRMS - Local Run Guide

This guide explains how to run the current NexusHR HRMS application locally from this workspace.

## 1. Current Local Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Axios, Recharts |
| Backend | Node.js 20+, Express 5, Prisma 6 |
| Local Database | SQLite |
| Reports | ExcelJS, PDFKit, CSV streaming |
| Tests | Jest, Supertest |
| Optional Mobile App | Flutter |

## 2. Required Tools

- Node.js 20 or later.
- npm.
- Git.
- Optional: Flutter SDK 3.x if you want to run `mobile_app`.

Check versions:

```powershell
node -v
npm -v
```

## 3. Environment Files

Backend file: `backend/.env`

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecretjwtkey"
JWT_EXPIRES_IN="7d"
PORT=5000
```

Frontend file: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## 4. First-Time Backend Setup

Open PowerShell:

```powershell
cd e:\HRMS_application\backend
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

Backend URLs:

```text
Backend API:  http://localhost:5000/api
Health check: http://localhost:5000/health
```

Expected health response:

```json
{ "status": "ok", "uptime": 123.45 }
```

## 5. First-Time Frontend Setup

Open a second PowerShell terminal:

```powershell
cd e:\HRMS_application\frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## 6. Login Credentials After Seeding

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `superadmin@hrms.com` | `admin123` |
| Admin | `admin@hrms.com` | `admin123` |
| Manager | `manager@hrms.com` | `admin123` |
| Employee | `rajesh.kumar@company.com` | `employee123` |
| Employee | `priya.sharma@company.com` | `employee123` |

The seed script creates a sample company, departments, employees, roles, permissions, payroll data, attendance data, projects, expenses, recruitment data, dashboards, and reports-related records.

## 7. Daily Development Commands

### Backend

```powershell
cd e:\HRMS_application\backend
npm run dev
```

Useful backend commands:

```powershell
npm start
npm run prisma:generate
npm run prisma:push
npm run seed
npm test
npx prisma studio --schema=prisma/schema.prisma
```

### Frontend

```powershell
cd e:\HRMS_application\frontend
npm run dev
```

Useful frontend commands:

```powershell
npm run build
npm start
```

## 8. Optional Mobile App

```powershell
cd e:\HRMS_application\mobile_app
flutter pub get
flutter run
```

The mobile app is a Flutter Employee Self Service portal codebase. Confirm API base URL handling inside the mobile app before using a physical device, because mobile devices cannot call `localhost` on your PC directly.

## 9. How to Reset Local Data

The seed script clears existing local data and recreates sample data.

```powershell
cd e:\HRMS_application\backend
npm run seed
```

Run this only when you are comfortable losing local test records in the SQLite database.

## 10. How to Validate the Application

### Backend Tests

```powershell
cd e:\HRMS_application\backend
npm test
```

### Frontend Build

```powershell
cd e:\HRMS_application\frontend
npm run build
```

### Manual Smoke Check

1. Open `http://localhost:5000/health`.
2. Open `http://localhost:3000`.
3. Login as `admin@hrms.com` with `admin123`.
4. Open dashboard, employees, attendance, leave, payroll, and reports.
5. Export one report as Excel, CSV, and PDF.
6. Login as an employee and confirm restricted admin pages are not accessible.

## 11. Troubleshooting

### Port Already In Use

Check the port:

```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

Stop the process:

```powershell
Stop-Process -Id <PID> -Force
```

### Backend Does Not Start

Run:

```powershell
cd e:\HRMS_application\backend
npm install
npm run prisma:generate
npm run prisma:push
```

Then start again:

```powershell
npm run dev
```

### Frontend Cannot Connect to API

Check:

- Backend is running on port `5000`.
- `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
- Browser can open `http://localhost:5000/health`.

### Prisma or Database Looks Stale

Run:

```powershell
cd e:\HRMS_application\backend
npm run prisma:generate
npm run prisma:push
npm run seed
```

### Production Build Fails After Dev Server Has Been Running

Stop the frontend dev server, then run:

```powershell
cd e:\HRMS_application\frontend
npm run build
npm run dev
```

## 12. Production Notes

The current local setup is optimized for development. Before production:

- Move database from SQLite to PostgreSQL or another managed relational database.
- Move local uploads to private object storage.
- Replace development secrets with managed secrets.
- Configure `ALLOWED_ORIGINS`.
- Enable HTTPS.
- Add centralized logs, monitoring, backups, and restore tests.
- Run full backend tests, frontend build, security tests, RBAC tests, and E2E smoke tests.

More technical detail is available in `docs/02_TRD_Technical_Requirements.md`.
