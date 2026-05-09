#!/bin/bash
cd "$(dirname "$0")/../frontend"

# Cross-platform port kill
kill_port() {
  local port=$1
  if command -v lsof &>/dev/null; then
    kill $(lsof -ti :"$port") 2>/dev/null
  else
    local pid
    pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $NF}' | head -1)
    [ -n "$pid" ] && taskkill //PID "$pid" //F 2>/dev/null
  fi
}

kill_port 5173
echo "Starting Vite frontend..."
npm run dev 2>&1 &
# Wait up to 60s for frontend to be ready
MAX_WAIT=60
ELAPSED=0
while ! curl -s -o /dev/null "http://localhost:5173" 2>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "ERROR: Frontend failed to start within ${MAX_WAIT}s. Check logs above."
    exit 1
  fi
done
echo "Frontend ready at http://localhost:5173"
