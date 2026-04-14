#!/bin/bash
# CircleSo Admin — Session Bootstrap Script
# Run this at the start of every agent session

set -e

PROJECT_DIR="/Volumes/shorya/apps/circleso"
PORT=3001

echo "=== CircleSo Admin — Session Bootstrap ==="
echo "Working directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# 1. Check Node.js
echo ""
echo "--- Node.js Check ---"
node --version || { echo "ERROR: Node.js not found"; exit 1; }
npm --version || { echo "ERROR: npm not found"; exit 1; }

# 2. Check .env.local exists
echo ""
echo "--- Environment Check ---"
if [ -f .env.local ]; then
  echo ".env.local found"
else
  echo "WARNING: .env.local not found — copy .env.example and fill in values"
  echo "  cp .env.example .env.local"
fi

# 3. Install dependencies if needed
echo ""
echo "--- Dependencies ---"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
else
  echo "node_modules exists"
fi

# 4. Type check
echo ""
echo "--- Type Check ---"
npx tsc --noEmit 2>&1 || echo "WARNING: Type errors found (may be expected if features are in progress)"

# 5. Start dev server (background)
echo ""
echo "--- Dev Server ---"
# Kill existing server on port 3001 if running
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Starting Next.js dev server on port $PORT..."
PORT=$PORT npm run dev &
DEV_PID=$!
echo "Dev server PID: $DEV_PID"

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
  if curl -s http://localhost:$PORT > /dev/null 2>&1; then
    echo "Server is ready at http://localhost:$PORT"
    break
  fi
  sleep 1
done

echo ""
echo "=== Bootstrap Complete ==="
echo "Dev server running on http://localhost:$PORT (PID: $DEV_PID)"
echo "Next: Read feature-list.json and pick the highest-priority incomplete feature"
