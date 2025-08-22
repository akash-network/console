# =============================================================================
# Log Collector Development Makefile
# =============================================================================
# This Makefile provides convenient commands for building, deploying, and managing
# the Log Collector in local Kubernetes environments.
#
# Prerequisites:
# - Local Kubernetes cluster (Docker Desktop, Minikube, Kind, or K3s)
# - kubectl configured to access your cluster
# - Docker for building container images
# =============================================================================

# Build Configuration
# IMAGE_NAME: Docker image name
# IMAGE_TAG: Docker image tag
# NAMESPACE: Kubernetes namespace for deployment
# K8S_DIR: Directory containing Kubernetes manifests
# ROOT_DIR: Path to monorepo root (for Docker build context)
IMAGE_NAME = log-collector
IMAGE_TAG = latest
NAMESPACE = log-collector
K8S_DIR = k8s
ROOT_DIR = ../..

# =============================================================================
# Available Targets
# =============================================================================

# Default target - shows available commands
.PHONY: help
help:
	@echo "Log Collector Development Commands:"
	@echo ""
	@echo "  dev       - Complete workflow: build, deploy, and restart"
	@echo "  logs      - View live logs from the running application"
	@echo "  clean     - Remove all Kubernetes resources from the namespace"
	@echo ""
	@echo "Examples:"
	@echo "  make dev        # Full development workflow"
	@echo "  make logs       # View application logs"
	@echo "  make clean      # Clean up resources"

# =============================================================================
# Dev Target
# =============================================================================
# Complete development workflow: builds, deploys, and shows logs
# Perfect for getting started or testing the full pipeline
#
# This target does everything in sequence:
# 1. Builds Docker image (if Dockerfile/src/fluent-bit changed)
# 2. Creates namespace
# 3. Generates ConfigMap from .env.local
# 4. Applies all Kubernetes resources
# 5. Restarts deployments to ensure latest ConfigMap is used
# 6. Waits for pods to be ready
.PHONY: dev
dev: $(ROOT_DIR)/apps/log-collector/Dockerfile $(ROOT_DIR)/apps/log-collector/src $(ROOT_DIR)/apps/log-collector/fluent-bit $(ROOT_DIR)/apps/log-collector/k8s
	@echo "🚀 Starting complete development workflow..."
	@echo "Building Docker image $(IMAGE_NAME):$(IMAGE_TAG)..."
	cd $(ROOT_DIR) && docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -f apps/log-collector/Dockerfile .
	@echo "✅ Image built successfully"
	@echo "🚀 Deploying to Kubernetes namespace: $(NAMESPACE)"
	@echo "Creating namespace..."
	kubectl apply -f $(K8S_DIR)/ns.yaml
	@echo "Generating ConfigMap from .env.local..."
	@kubectl create configmap log-collector-config --from-env-file=$(K8S_DIR)/.env.local -n $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "Applying Kubernetes resources..."
	kubectl apply -f $(K8S_DIR)
	@echo "✅ Deployment completed successfully"
	@echo "🔄 Restarting deployments to ensure latest ConfigMap is used..."
	kubectl rollout restart deployment/$(IMAGE_NAME) -n $(NAMESPACE)
	kubectl rollout restart deployment/log-target -n $(NAMESPACE)
	@echo "📋 Waiting for pod to be ready..."
	@kubectl wait --for=condition=ready pod -l app=log-collector -n $(NAMESPACE) --timeout=60s
	@echo "✅ Development workflow completed successfully"
	@echo "💡 Run 'make logs' to view application logs"

# =============================================================================
# Logs Target
# =============================================================================
# View live logs from the running application
# Useful for monitoring and debugging
.PHONY: logs
logs:
	@echo "📝 Viewing live logs from $(IMAGE_NAME) deployment..."
	@echo "Press Ctrl+C to exit"
	kubectl logs -f deployment/$(IMAGE_NAME) -n $(NAMESPACE)

# =============================================================================
# Clean Target
# =============================================================================
# Removes all Kubernetes resources from the namespace
# Useful for starting fresh or troubleshooting
.PHONY: clean
clean:
	@echo "🧹 Cleaning up Kubernetes resources..."
	kubectl delete -f $(K8S_DIR)/ --ignore-not-found=true
	@echo "✅ Cleanup completed"