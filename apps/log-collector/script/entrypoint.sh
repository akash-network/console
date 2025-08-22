#!/usr/bin/env bash

# Enable strict error handling and safe shell behavior
# -e: Exit immediately if any command fails
# -u: Exit if any undefined variable is used
# -o pipefail: Exit if any command in a pipeline fails
set -euo pipefail

node ./apps/log-collector/fluent-bit/scripts/define-outputs.js /etc/fluent-bit/fluent-bit.conf

# Set Fluent Bit log level with fallback to 'info'
# This environment variable is used in fluent-bit.conf for Log_Level setting
export FB_LOG_LEVEL="${FB_LOG_LEVEL:-info}"

echo "[entrypoint] Starting Fluent Bit with log level: $FB_LOG_LEVEL"

# Start Fluent Bit in background for log collection and forwarding
# -c: Specify configuration file path for Fluent Bit configuration
# &: Run in background to allow parallel execution with Node.js app
fluent-bit -c /etc/fluent-bit/fluent-bit.conf &
FB_PID=$!

# Wait for Fluent Bit to initialize and stabilize
# This prevents race conditions between services
sleep 2

# Verify Fluent Bit is running successfully
# kill -0 checks if process exists without sending signals
# Redirect stderr to /dev/null to suppress error messages
if ! kill -0 "$FB_PID" 2>/dev/null; then
  echo "Fluent Bit failed to start"
  exit 1
fi

# Start the Node.js log collector application in background
# -w: Specify workspace for npm command
# &: Run in background to allow parallel execution
npm run prod -w apps/log-collector &

# Wait for any of the background processes to exit
# -n: Wait for any child process to terminate (either Fluent Bit or Node.js)
wait -n

# Exit with the same code as the process that terminated
# This ensures proper error propagation to the container and Kubernetes
# Exit codes are preserved for proper health check and restart handling
exit $?