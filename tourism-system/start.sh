#!/bin/bash

echo "=== 个性化旅游系统启动脚本 ==="

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到npm，请先安装npm"
    exit 1
fi

echo "1. 安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装Python依赖..."
pip install -r requirements.txt

echo "2. 启动后端服务..."
echo "后端服务将在 http://localhost:5001 启动"
python app.py &
BACKEND_PID=$!

# 等待后端启动
sleep 3

echo "3. 安装前端依赖..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "安装Node.js依赖..."
    npm install
fi

echo "4. 启动前端服务..."
echo "前端服务将在 http://localhost:3000 启动"
npm start &
FRONTEND_PID=$!

echo ""
echo "=== 系统启动完成 ==="
echo "后端API: http://localhost:5001"
echo "前端界面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait 