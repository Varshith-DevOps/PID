#!/bin/bash
# PID HCMS — EC2 Production Deployment & Database Provisioning
set -e

echo "=========================================================="
echo " 1. PULLING LATEST CODE FROM GITHUB (origin/master)"
echo "=========================================================="
git pull origin master

echo ""
echo "=========================================================="
echo " 2. REBUILDING DOCKER IMAGES"
echo "=========================================================="
docker build -t hrms_backend:latest ./backend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://13.232.70.236:5000/api \
  -t hrms_frontend:latest \
  -f ./frontend/Dockerfile .

echo ""
echo "=========================================================="
echo " 3. STARTING DOCKER CONTAINERS (hrms_postgres, backend, frontend)"
echo "=========================================================="
docker compose up -d

echo ""
echo "=========================================================="
echo " 4. SYNCING DEDICATED POSTGRESQL DATABASE SCHEMA"
echo "=========================================================="
docker exec -i hrms_backend sh -c "node scripts/make-postgres-schema.js && npx prisma db push --schema=prisma/schema.postgres.prisma"

echo ""
echo "=========================================================="
echo " 5. PROVISIONING PROFILES FOR ALL 7 TEST ACCOUNTS"
echo "=========================================================="
docker exec -i hrms_backend node scripts/verify-all-7-accounts.js

echo ""
echo "=========================================================="
echo " 6. RUNNING AUTOMATED ATTENDANCE MATRIX VERIFICATION"
echo "=========================================================="
docker exec -i hrms_backend node scripts/test-all-roles-attendance.js

echo ""
echo "=========================================================="
echo " 7. DEPLOYMENT & VERIFICATION COMPLETE"
echo "=========================================================="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -sf http://localhost:5000/health/live && echo "Backend Health: OK" || echo "Backend check failed"
