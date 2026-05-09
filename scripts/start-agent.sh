#!/bin/bash
cd "$(dirname "$0")/../agent-service"

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

kill_port 9000
echo "Starting Python agent service..."
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 9000 2>&1 &
# Wait up to 60s for agent to be ready
MAX_WAIT=60
ELAPSED=0
while ! curl -s -o /dev/null "http://localhost:9000/health" 2>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "ERROR: Agent failed to start within ${MAX_WAIT}s. Check logs above."
    exit 1
  fi
done
echo "Agent ready at http://localhost:9000"
echo "Health: http://localhost:9000/health"
