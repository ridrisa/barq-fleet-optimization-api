#!/bin/bash

# Kill processes on ports used by the application
# Backend: 3003, WebSocket: 8081, Frontend: 3001

echo "🧹 Cleaning up ports..."

# Kill process on port 3003 (Backend)
PORT_3003=$(lsof -ti:3003)
if [ ! -z "$PORT_3003" ]; then
  echo "  ⚠️  Killing process on port 3003..."
  kill -9 $PORT_3003 2>/dev/null && echo "  ✅ Port 3003 cleared"
fi

# Kill process on port 8081 (WebSocket)
PORT_8081=$(lsof -ti:8081)
if [ ! -z "$PORT_8081" ]; then
  echo "  ⚠️  Killing process on port 8081..."
  kill -9 $PORT_8081 2>/dev/null && echo "  ✅ Port 8081 cleared"
fi

# Kill process on port 3001 (Frontend)
PORT_3001=$(lsof -ti:3001)
if [ ! -z "$PORT_3001" ]; then
  echo "  ⚠️  Killing process on port 3001..."
  kill -9 $PORT_3001 2>/dev/null && echo "  ✅ Port 3001 cleared"
fi

echo "✅ Ports cleaned!"
