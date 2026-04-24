#!/bin/bash
kill $(lsof -ti :8080) 2>/dev/null && echo "Backend stopped" || echo "Backend not running"
kill $(lsof -ti :5173) 2>/dev/null && echo "Frontend stopped" || echo "Frontend not running"
