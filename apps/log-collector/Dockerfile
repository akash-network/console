# ----------- BUILDER -------------
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y bash
SHELL ["/bin/bash", "-c"]

WORKDIR /app

COPY package*.json ./
COPY apps/log-collector/package.json ./apps/log-collector/
RUN npm ci

COPY . .
RUN npm run build -w apps/log-collector

# ----------- PRODUCTION ----------
FROM node:20-slim AS production

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
ENV PATH="/opt/fluent-bit/bin:${PATH}"

# Create non-root user and group for security
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/bash appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/apps/log-collector/package.json ./apps/log-collector/
RUN npm ci --omit=dev -w apps/log-collector

COPY --from=builder --chown=appuser:appuser /app/apps/log-collector/dist ./apps/log-collector/dist/

COPY --chown=appuser:appuser apps/log-collector/fluent-bit/fluent-bit.conf /etc/fluent-bit/fluent-bit.conf
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/parsers.conf /etc/fluent-bit/parsers.conf
COPY --chown=appuser:appuser apps/log-collector/fluent-bit/scripts/extract_service.lua /etc/fluent-bit/extract_service.lua

# Ensure proper permissions for log directories and app working directory
RUN mkdir -p /app/apps/log-collector/log && chown -R appuser:appuser /app/apps/log-collector/log
RUN chown -R appuser:appuser /app

ENV NODE_ENV=production

# Switch to non-root user for security
USER appuser

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/bin/bash", "-c", "fluent-bit -c /etc/fluent-bit/fluent-bit.conf & npm run prod -w apps/log-collector"]