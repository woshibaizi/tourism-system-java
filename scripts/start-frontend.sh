#!/bin/bash
cd "$(dirname "$0")/../frontend"
kill $(lsof -ti :5173) 2>/dev/null
echo "Starting Vite frontend..."
npm run dev 2>&1 &
sleep 2
echo "Frontend ready at http://localhost:5173"
