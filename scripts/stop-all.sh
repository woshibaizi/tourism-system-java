#!/bin/bash
# Stop all tourism services

# Helper: kill process by port (cross-platform)
kill_port() {
  local port=$1
  local name=$2
  if command -v lsof &>/dev/null; then
    kill $(lsof -ti :"$port") 2>/dev/null && echo "$name (port $port) stopped" || echo "$name (port $port) not running"
  else
    # Windows fallback: use netstat + taskkill
    local pid
    pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $NF}' | head -1)
    if [ -n "$pid" ]; then
      taskkill //PID "$pid" //F 2>/dev/null && echo "$name (port $port) stopped (PID $pid)" || echo "$name (port $port) failed to stop"
    else
      echo "$name (port $port) not running"
    fi
  fi
}

kill_port 8080 "Backend"
kill_port 5173 "Frontend"
kill_port 9000 "Agent"
