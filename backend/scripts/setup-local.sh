#!/bin/bash

echo "========================================"
echo "     HRMS Local Setup Script"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "[1/5] Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Backend dependencies failed"
    exit 1
fi

echo ""
echo "[2/5] Adding Recharts to frontend..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend dependencies failed"
    exit 1
fi

echo ""
echo "[3/5] Checking PostgreSQL..."
if ! command -v pg_isready &> /dev/null; then
    echo "WARNING: PostgreSQL not installed"
    echo "Please install PostgreSQL and start the service"
    read -p "Press Enter to continue..."
fi

echo ""
echo "[4/5] Generating Prisma client..."
cd ../backend
npx prisma generate
if [ $? -ne 0 ]; then
    echo "ERROR: Prisma generate failed"
    exit 1
fi

echo ""
echo "[5/5] Pushing schema to database..."
npx prisma db push
if [ $? -ne 0 ]; then
    echo "ERROR: Database push failed"
    echo "Check your DATABASE_URL in backend/.env"
    exit 1
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo ""
echo "Starting servers..."
echo ""

# Start backend
node src/index.js &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop servers"

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait