# Akash Log Collector

The Log Collector is a Kubernetes-native application designed to run on Akash Network that automatically collects logs from all pods in a namespace (except itself) and forwards them to external logging providers.

## Overview

The Log Collector leverages internal Kubernetes access to discover and stream logs from all pods in its deployment namespace. It automatically excludes itself from log collection to prevent infinite loops and forwards the collected logs to configured external logging services.

**Current Status**: Datadog integration is fully implemented, with support for additional providers planned. Work on edge cases like connection drops and improved error handling is also planned.

## Image Location

```
ghcr.io/akash-network/log-collector
```

## How It Works

1. **Namespace Discovery**: The collector automatically detects the Kubernetes namespace it's deployed in
2. **Pod Discovery**: Scans the namespace for all running pods
3. **Log Streaming**: Establishes log streams for each pod (excluding itself)
4. **Log Forwarding**: Sends collected logs to the configured external logging provider
5. **Metadata Enrichment**: Adds Kubernetes metadata (namespace, pod name, etc.) to each log entry

## Configuration

### Required Environment Variables

| Variable      | Description                                 | Example   |
| ------------- | ------------------------------------------- | --------- |
| `DESTINATION` | Logging provider (currently only `DATADOG`) | `DATADOG` |

### Datadog Configuration

When `DESTINATION=DATADOG`, the following variables are required:

| Variable     | Description      | Example             |
| ------------ | ---------------- | ------------------- |
| `DD_SITE`    | Datadog site URL | `datadoghq.com`     |
| `DD_API_KEY` | Datadog API key  | `your-api-key-here` |

### Optional Environment Variables

| Variable           | Description                    | Default | Example |
| ------------------ | ------------------------------ | ------- | ------- |
| `WRITE_TO_CONSOLE` | Enable console output for logs | `false` | `true`  |

## Deployment Example

See the complete deployment example in [example.sdl.yaml](./example.sdl.yaml).

### Basic SDL Configuration

```yaml
services:
  log-collector:
    image: ghcr.io/akash-network/log-collector:latest
    env:
      - DESTINATION=DATADOG
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
          size: 512Mi

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

## Features

### Automatic Pod Discovery

- Discovers all pods in the deployment namespace
- Automatically excludes itself from log collection
- Handles pod lifecycle changes (new pods, terminated pods)

### Log Streaming

- Real-time log streaming from all discovered pods
- Automatic reconnection on pod restarts
- Configurable log tail lines (default: 10)

### Metadata Enrichment

Each log entry is enriched with Kubernetes metadata:

- `namespace`: The pod's namespace
- `pod`: The pod name
- `service`: The pod name (for service identification)
- `kubernetes_namespace`: Namespace identifier
- `kubernetes_pod`: Pod identifier
- `hostname`: Pod hostname
- `source`: Application source identifier
- `environment`: Environment identifier

### Debug Mode

Enable console output to see logs in the pod's console:

```yaml
env:
  - WRITE_TO_CONSOLE=true
```

## Development

### Development Configuration

For development, you can use additional environment variables:

| Variable                        | Description                 | Default         | Example           |
| ------------------------------- | --------------------------- | --------------- | ----------------- |
| `HOSTNAME`                      | Pod name (for testing)      | Auto-detected   | `test-pod-123`    |
| `KUBERNETES_NAMESPACE_OVERRIDE` | Override detected namespace | Auto-detected   | `test-namespace`  |
| `ENVIRONMENT`                   | Environment identifier      | `default`       | `development`     |
| `SOURCE`                        | Source identifier for logs  | `akash.network` | `dev-application` |
| `DATADOG_DEBUG`                 | Enable Datadog debug mode   | `false`         | `true`            |

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
docker run -e DESTINATION=DATADOG -e DD_SITE=your-site -e DD_API_KEY=your-key log-collector:local

# or
docker run --env-file apps/log-collector/env/.env.local log-collector:local

```

## Roadmap

### Short Term (Next Release)

- **Connection Resilience**: Improved handling of connection drops and network interruptions
- **Enhanced Error Handling**: Better error recovery and retry mechanisms
- **Log Filtering**: Basic log filtering capabilities (by log level, source, etc.)

### Medium Term (2-3 Releases)

- **Additional Logging Providers**: Support for Loki, Elasticsearch, and other popular logging services
