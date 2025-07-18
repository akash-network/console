FROM node:20-alpine AS builder

RUN apk add --no-cache bash
SHELL ["/bin/bash", "-c"]

WORKDIR /app

COPY package*.json ./
COPY apps/log-collector/package.json ./apps/log-collector/

RUN npm ci

COPY . .

RUN npm run build -w apps/log-collector

FROM node:20-alpine AS production

RUN apk add --no-cache bash
SHELL ["/bin/bash", "-c"]

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/log-collector/package.json ./apps/log-collector/

RUN npm ci --omit=dev -w apps/log-collector

COPY --from=builder /app/apps/log-collector/dist ./apps/log-collector/dist/

ENV NODE_ENV=production

CMD ["node", "apps/log-collector/dist/server.js"]