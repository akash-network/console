# Akash Log Collector

The Log Collector is a Kubernetes-native application designed to run on Akash Network that automatically collects logs from all pods in a namespace (except itself) and writes them to files for external log agents to process.

## Overview

The Log Collector leverages internal Kubernetes access to discover and stream logs from all pods in its deployment namespace. It automatically excludes itself from log collection to prevent infinite loops and writes the collected logs to files for external log agents to process.

## Features

- **Automatic Pod Discovery**: Discovers all pods in the deployment namespace and automatically excludes itself
- **Real-time Log Streaming**: Streams logs from all discovered pods with automatic reconnection on pod restarts
- **File-based Output**: Writes raw logs to files organized by namespace and pod name
- **Automatic Log Rotation**: Rotates log files when they reach configurable size limits
- **Configurable Log Tail**: Configurable log tail lines (default: 100)
- **File Naming Convention**: `{namespace}_{podName}.log`
- **Log Collection**: Uses Fluent Bit to collect logs from files and forward to external services
- **Log Directory**: Logs are stored in `/app/apps/log-collector/log/` within the container

## How It Works

1. **Namespace Discovery**: The collector automatically detects the Kubernetes namespace it's deployed in
2. **Pod Discovery**: Scans the namespace for all running pods (excluding pods from the same deployment)
3. **Log Streaming**: Establishes log streams for each pod
4. **File Output**: Writes collected logs to files for external processing
5. **Log Rotation**: Automatically rotates log files when they reach the configured size limit, maintaining up to `LOG_MAX_ROTATED_FILES` rotated files
6. **Log Collection**: Fluent Bit monitors the log files and forwards them to configured external services like Datadog

## Configuration

### Production Configuration

These are the environment variables you need to configure for production deployment:

| Variable                  | Description                   | Default             | Example             |
| ------------------------- | ----------------------------- | ------------------- | ------------------- |
| `LOG_MAX_FILE_SIZE_BYTES` | Max file size before rotation | `10_485_760` (10MB) | `20_971_520` (20MB) |
| `LOG_MAX_ROTATED_FILES`   | Max number of rotated files   | `5`                 | `10`                |

### Log Collection Configuration (Datadog)

To forward logs to Datadog, configure these environment variables:

| Variable       | Description          | Example             |
| -------------- | -------------------- | ------------------- |
| `DD_SITE`      | Datadog site URL     | `datadoghq.com`     |
| `DD_API_KEY`   | Datadog API key      | `your-api-key-here` |
| `DD_TAGS`      | Additional tags      | `env:prod,team:dev` |
| `FB_LOG_LEVEL` | Fluent Bit log level | `info`              |

## Deployment

### Image Location

```text
ghcr.io/akash-network/log-collector
```

### Akash Network Deployment

```yaml
services:
  log-collector:
    image: ghcr.io/akash-network/log-collector:latest
    env:
      - DD_SITE=datadoghq.com
      - DD_API_KEY=your-datadog-api-key
    expose:
      - port: 3000
        as: 80
        to:
          - global: true

profiles:
  compute:
    log-collector:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi

  placement:
    dcloud:
      pricing:
        log-collector:
          denom: uakt
          amount: 10000

deployment:
  log-collector:
    dcloud:
      profile: log-collector
      count: 1
```

## Development

### Development Configuration

For local development and testing, you can override the automatic detection:

| Variable                        | Description                 | Default       | Example          |
| ------------------------------- | --------------------------- | ------------- | ---------------- |
| `HOSTNAME`                      | Pod name (for testing)      | Auto-detected | `test-pod-123`   |
| `KUBERNETES_NAMESPACE_OVERRIDE` | Override detected namespace | Auto-detected | `test-namespace` |

### Development Workflow

```bash
# 1. Start development server
npm run dev

# 2. Test the application
npm test

# 3. Build for production
npm run build

# 4. Test production build
npm run prod

# 5. Build Docker image
docker build -f apps/log-collector/Dockerfile -t log-collector:local .

# 6. Run Docker image
docker run -e HOSTNAME=test-pod log-collector:local

# or
docker run --env-file apps/log-collector/env/.env.local log-collector:local
```

## Roadmap

- **Fluent Bit Templating**: Support for multiple configurable destinations beyond Datadog
