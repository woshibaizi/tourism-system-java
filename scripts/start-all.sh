#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
echo "=== 启动所有服务 ==="
echo ""
bash "$SCRIPT_DIR/start-backend.sh" &
bash "$SCRIPT_DIR/start-frontend.sh" &
bash "$SCRIPT_DIR/start-agent.sh" &
wait
echo ""
echo "=== 所有服务已启动 ==="
echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:5173"
echo "Agent:    http://localhost:9000"
