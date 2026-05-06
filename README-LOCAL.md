# HRMS - Local Hosting Guide

A comprehensive Human Resource Management System with complete authentication, RBAC, and HR modules.

## Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **npm**: 9.x or higher

## Quick Start (Docker - Recommended)

### Option 1: Docker Compose (Easiest)

```bash
# Clone/download the project
cd hrms-application

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
```

### Option 2: Manual Setup

#### Step 1: Install PostgreSQL

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- During installation, set password: `password`
- Keep default port: `5432`

**Mac:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hrms;

# Exit
\q
```

#### Step 3: Configure Environment

```bash
# Navigate to backend
cd backend

# Copy example env file
copy .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="postgresql://postgres:password@localhost:5432/hrms"
```

#### Step 4: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (new terminal)
cd frontend
npm install
```

#### Step 5: Setup Database

```bash
cd backend
npx prisma generate
npx prisma db push
```

#### Step 6: Start Servers

```bash
# Terminal 1 - Backend
cd backend
node src/index.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Access the Application

| Service     | URL                    |
|-------------|------------------------|
| Frontend    | http://localhost:3000  |
| Backend API | http://localhost:5000  |
| Health      | http://localhost:5000/health |

## Default Login Credentials

After seeding the database:

| Role       | Email              | Password   |
|------------|--------------------|------------|
| Super Admin | admin@hrms.com    | admin123   |
| Admin      | manager@hrms.com   | admin123   |
| Manager    | manager@hrms.com   | admin123   |
| Employee   | employee@hrms.com  | admin123   |

## Project Structure

```
hrms-application/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js         # Seed data
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth middleware
│   │   ├── services/        # Business logic
│   │   └── config/         # Database config
│   ├── scripts/             # Setup scripts
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages
│   │   ├── lib/           # API & auth
│   │   └── components/    # React components
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README-LOCAL.md
```

## Features

- **Authentication**: JWT-based login with role management
- **RBAC**: Granular permissions per module
- **Employee Management**: CRUD, documents, org chart
- **Attendance**: Check-in/out, daily tracking
- **Leave Management**: Request, approve/reject workflow
- **Payroll**: Salary structure, PF, TDS, Gratuity
- **Payslips**: PDF generation, email
- **Projects**: Project & task management
- **Timesheet**: Daily work logging
- **Overtime**: OT request & approval
- **Utilization**: Employee workload tracking
- **Dashboards**: Role-based analytics with charts

## Troubleshooting

### PostgreSQL Connection Error

```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Restart PostgreSQL
sudo systemctl restart postgresql    # Linux
pg_ctl restart -D /usr/local/var/postgres  # Mac
```

### Port Already in Use

```bash
# Kill process on port
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Prisma Errors

```bash
# Reset Prisma
cd backend
rm -rf node_modules/.prisma
npx prisma generate
npx prisma db push
```

### Build Errors (Frontend)

```bash
cd frontend
rm -rf .next
npm run build
```

## Seeding Test Data

```bash
cd backend
node prisma/seed.js
```

## API Documentation

Base URL: `http://localhost:5000/api`

| Endpoint                | Description           |
|-------------------------|----------------------|
| /api/auth/login         | Login                |
| /api/employees          | Employee CRUD        |
| /api/attendance         | Attendance tracking  |
| /api/leave              | Leave management     |
| /api/payroll            | Payroll processing  |
| /api/projects           | Project management   |
| /api/timesheet         | Work hour logging    |
| /api/overtime           | Overtime requests    |
| /api/utilization        | Resource tracking    |

## Development Commands

```bash
# Backend
npm run dev          # Start dev server
npx prisma studio    # Open Prisma GUI
npx prisma migrate   # Run migrations

# Frontend
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint code
```
