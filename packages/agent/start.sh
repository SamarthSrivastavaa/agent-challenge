#!/bin/bash
# Use local tsx binary (installed as devDependency)
TSX=/app/node_modules/.bin/tsx

echo "Starting SovereignSelf agent..."
$TSX packages/agent/src/index.ts &
AGENT_PID=$!

echo "Starting API + WebSocket server..."
$TSX packages/api/src/index.ts &
API_PID=$!

echo "Both processes started. Agent PID=$AGENT_PID  API PID=$API_PID"

wait -n
EXIT_CODE=$?
echo "A process exited (code $EXIT_CODE) — shutting down container"
kill $AGENT_PID $API_PID 2>/dev/null
exit $EXIT_CODE