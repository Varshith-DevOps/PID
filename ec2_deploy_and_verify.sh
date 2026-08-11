#!/bin/bash
# PID HCMS — EC2 Production Deployment & Database Provisioning
set -e

echo "=========================================================="
echo " 1. PULLING LATEST CODE FROM GITHUB (origin/master)"
echo "=========================================================="
git pull origin master

echo ""
echo "=========================================================="
echo " 2. REBUILDING BACKEND AND FRONTEND DOCKER IMAGES"
echo "=========================================================="
docker build -t hrms_backend:latest ./backend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://13.232.70.236:5000/api \
  -t hrms_frontend:latest \
  -f ./frontend/Dockerfile .

echo ""
echo "=========================================================="
echo " 3. RESTARTING DOCKER CONTAINERS"
echo "=========================================================="
docker compose up -d --no-deps --build backend frontend

echo ""
echo "=========================================================="
echo " 4. SYNCING POSTGRESQL DATABASE SCHEMA"
echo "=========================================================="
docker exec -i hrms_backend npx prisma db push --accept-data-loss

echo ""
echo "=========================================================="
echo " 5. PROVISIONING & REPAIRING DATABASE PROFILES FOR ALL 7 TEST ACCOUNTS"
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
curl -sf http://localhost:5000/health/live && echo "Backend: OK" || echo "Backend check failed"
