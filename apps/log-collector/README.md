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
2. **Pod Discovery**: Scans the namespace for all running pods (excluding pods from the same deployment), with optional label-based filtering via `POD_LABEL_SELECTOR`
3. **Log Streaming**: Establishes log streams for each pod
4. **File Output**: Writes collected logs to files for external processing
5. **Log Rotation**: Automatically rotates log files when they reach the configured size limit, maintaining up to `LOG_MAX_ROTATED_FILES` rotated files
6. **Log Collection**: Fluent Bit monitors the log files and forwards them to configured external services like Datadog

## Configuration

### Production Configuration

These are the environment variables you need to configure for production deployment:

| Variable                  | Description                                 | Default             | Example                            |
| ------------------------- | ------------------------------------------- | ------------------- | ---------------------------------- |
| `LOG_MAX_FILE_SIZE_BYTES` | Max file size before rotation               | `10_485_760` (10MB) | `20_971_520` (20MB)                |
| `LOG_MAX_ROTATED_FILES`   | Max number of rotated files                 | `5`                 | `10`                               |
| `POD_LABEL_SELECTOR`      | Kubernetes label selector for pod discovery | unset (all pods)    | `"app=web,environment=production"` |
### Log Collection Configuration

**Note**: Output destinations are automatically configured at startup based on environment variables. No manual configuration files needed.

#### Fluent Bit Configuration

| Variable       | Description          | Example |
| -------------- | -------------------- | ------- |
| `FB_LOG_LEVEL` | Fluent Bit log level | `info`  |

#### Datadog Output (Automatic)

To enable Datadog log forwarding, set these environment variables:

| Variable     | Description      | Example             |
| ------------ | ---------------- | ------------------- |
| `DD_SITE`    | Datadog site URL | `datadoghq.com`     |
| `DD_API_KEY` | Datadog API key  | `your-api-key-here` |

**Note**: The system automatically sets `dd_source` to `akash.network` and uses `message` as the message key.

#### Stdout Output (Automatic)

To enable stdout output for debugging, set:
| Variable | Description | Example |
| -------------- | -------------------- | ------------------- |
| `STDOUT` | Enable stdout output | `true` |

**How it works**: The system automatically includes the appropriate output configuration files based on the environment variables present. No manual configuration needed.

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

### Manual Development

#### Configuration

For local development and testing, you can override the automatic detection:

| Variable                        | Description                 | Default       | Example          |
| ------------------------------- | --------------------------- | ------------- | ---------------- |
| `HOSTNAME`                      | Pod name (for testing)      | Auto-detected | `test-pod-123`   |
| `KUBERNETES_NAMESPACE_OVERRIDE` | Override detected namespace | Auto-detected | `test-namespace` |

#### Flow

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

### Using Makefile (Recommended)

#### Prerequisites

To use the Makefile workflow, you need:

- **Local Kubernetes cluster** (Docker Desktop, Minikube, Kind, or K3s)
- **kubectl** configured to access your cluster
- **Docker** for building the container image

The project includes a Makefile for easy development:

```bash
# See all available commands
make help

# Complete development workflow (build, deploy, restart)
make dev

# View application logs
make logs

# Clean up all resources
make clean
```

#### What `make dev` Does

The `make dev` command handles the complete development workflow:

1. **Builds Docker image** (only if source files changed)
2. **Creates namespace** and applies Kubernetes resources
3. **Generates ConfigMap** from your `.env.local` file
4. **Restarts deployments** to ensure latest configuration is used
5. **Waits for pods** to be ready

This ensures your configuration changes are always applied. After deployment, you can run `make logs` to view the application logs.

#### Environment Configuration

Copy the sample environment file and customize it for your setup:

```bash
# Copy the sample file
cp k8s/.env.local.sample k8s/.env.local

# Edit the file with your actual values
# apps/log-collector/k8s/.env.local
DD_API_KEY=your-actual-datadog-api-key
DD_SITE=datadoghq.com   # or datadoghq.eu for EU
STDOUT=true             # set to false to disable stdout output
```

**Note**: The ConfigMap is automatically generated from your `.env.local` file when you run `make dev`. No need to manually create or update Kubernetes ConfigMaps.

## Roadmap

- **Additional Output Plugins**: Support for more output destinations (Elasticsearch, Splunk, etc.)
