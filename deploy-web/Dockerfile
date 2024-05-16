FROM node:18 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
#RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY patches ./patches
COPY package.json package-lock.json* ./
RUN npm install -D @next/swc-linux-x64-gnu
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM node:18 AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

#RUN apk update
RUN apt-get update
RUN apt-get install libcap2-bin -y
RUN setcap cap_net_bind_service=+ep `readlink -f \`which node\``

# Setup nginx for HTTPS
RUN apt-get install nginx -y
RUN mkdir -p /etc/nginx/ssl
RUN openssl req -x509 -newkey rsa:4096 -sha256 -nodes -keyout /etc/nginx/ssl/my_ssl_key.key -out /etc/nginx/ssl/my_ssl_cert.crt -subj "/CN=cloudmos.io" -days 600
COPY nginx.conf /etc/nginx/nginx.conf
RUN nginx -t

#USER nextjs

#EXPOSE 3001
EXPOSE 80
EXPOSE 443

ENV PORT 3001
#ENV PORT 80

#CMD ["node", "server.js"]
CMD sed -i "s/127.0.0.1/$(hostname -i)/" /etc/nginx/nginx.conf && service nginx start && node server.js