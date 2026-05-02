#!/bin/bash
cd "$(dirname "$0")/../agent-service"
kill $(lsof -ti :9000) 2>/dev/null
echo "Starting Python agent service..."
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 9000 2>&1 &
while ! curl -s -o /dev/null "http://localhost:9000/health" 2>/dev/null; do
  sleep 1
done
echo "Agent ready at http://localhost:9000"
echo "Health: http://localhost:9000/health"
