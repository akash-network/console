# ----------- BUILDER STAGE ----------
# Multi-stage build to optimize final image size
# This stage compiles TypeScript and installs all dependencies
FROM node:24.11.1-slim AS builder

# Install bash for better shell scripting support
RUN apt-get update && apt-get install -y bash
SHELL ["/bin/bash", "-c"]

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./
COPY apps/log-collector/package.json ./apps/log-collector/
RUN npm ci

# Copy source code and build the application
COPY . .
RUN npm run build -w apps/log-collector

# ----------- PRODUCTION STAGE ----------
# Final production image with minimal dependencies
# Contains only runtime requirements and compiled application
FROM node:24.11.1-slim AS production

# Install system dependencies and Fluent Bit
# - bash: Shell scripting support
# - curl: Download Fluent Bit repository key
# - gnupg: GPG key verification
# - libyaml-0-2: YAML parsing support
# - tini: Process manager for proper signal handling
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    gnupg \
    libyaml-0-2 \
    tini \
    && curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor > /usr/share/keyrings/fluentbit-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main" > /etc/apt/sources.list.d/fluent-bit.list \
    && apt-get update \
    && apt-get install -y fluent-bit \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add Fluent Bit to PATH for easy access
ENV PATH="/opt/fluent-bit/bin:${PATH}"

# Create non-root user and group for security
# This follows security best practices by not running as root
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/bash appuser

WORKDIR /app

# Copy production dependencies from builder stage
# Only production packages are installed to minimize image size
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/apps/log-collector/package.json ./apps/log-collector/
RUN npm ci --omit=dev -w apps/log-collector

# Copy compiled application from builder stage
COPY --from=builder --chown=appuser:appuser /app/apps/log-collector/dist ./apps/log-collector/dist/

# Copy Fluent Bit configuration files
# These files configure log collection and processing
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/base-fluent-bit.conf /app/apps/log-collector/fluent-bit/
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/parsers.conf /etc/fluent-bit/parsers.conf
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/outputs /etc/fluent-bit/outputs
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/script/define-outputs.js /app/apps/log-collector/fluent-bit/script/
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/script/extract_metadata.lua /etc/fluent-bit/extract_metadata.lua

# Copy entrypoint script for container startup
COPY --chown=appuser:appuser apps/log-collector/script/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create and configure log directories with proper ownership
# Application logs are stored in /app/apps/log-collector/log
RUN mkdir -p /app/apps/log-collector/log && chown -R appuser:appuser /app/apps/log-collector/log
RUN chown -R appuser:appuser /app

# Create Fluent Bit directories for storage, database, and logs
# - /var/lib/fluent-bit/storage: Persistent storage for file tracking
# - /var/log/fluent-bit: Fluent Bit internal logs
# - /etc/fluent-bit: Configuration files and scripts (with appuser permissions for runtime modifications)
RUN mkdir -p /var/lib/fluent-bit/storage \
    && mkdir -p /var/log/fluent-bit \
    && chown -R appuser:appuser /var/lib/fluent-bit /var/log/fluent-bit \
    && chown -R appuser:appuser /etc/fluent-bit \
    && mkdir -p /app/apps/log-collector/dist \
    && chown -R appuser:appuser /app/apps/log-collector/dist

# Set Node.js environment to production
ENV NODE_ENV=production

# Switch to non-root user for security
# This ensures the container runs with minimal privileges
USER appuser

# Use tini as init system for proper process management
# tini handles zombie process cleanup and signal forwarding
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the application using the entrypoint script
# The script manages both Fluent Bit and Node.js processes
CMD ["/entrypoint.sh"]