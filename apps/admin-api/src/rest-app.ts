import "./app";

import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { container } from "tsyringe";

import packageJson from "../package.json";
import { userStatsRouter } from "./analytics/routes/user-stats.router";
import { AdminAuthInterceptor } from "./auth/services/admin-auth.interceptor";
import { ADMIN_CONFIG } from "./core/providers/config.provider";
import { connectToDatabase } from "./db/dbConnection";
import { healthzRouter } from "./healthz/routes/healthz.router";
import { listUsersRouter } from "./user/routes/list-users/list-users.router";
import { searchUsersRouter } from "./user/routes/search-users/search-users.router";

const logger = LoggerService.forContext("APP");

const app = new Hono();

// CORS configuration
app.use(
  "/*",
  cors({
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    origin: origin => {
      const origins = container.resolve(ADMIN_CONFIG).CORS_WEBSITE_URLS?.split(",") || [];
      return origins.includes(origin) ? origin : null;
    },
    credentials: true
  })
);

// HTTP logging
app.use(container.resolve(HttpLoggerInterceptor).intercept());

// Health check (no auth required)
app.route("/", healthzRouter);

// Auth interceptor for protected routes
app.use("/v1/admin/*", container.resolve(AdminAuthInterceptor).intercept());

// OpenAPI routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openApiRouters: OpenAPIHono<any>[] = [listUsersRouter, searchUsersRouter, userStatsRouter];

for (const router of openApiRouters) {
  app.route("/", router);
}

// Status endpoint
app.get("/status", c => {
  const version = packageJson.version;
  return c.json({ version, status: "ok" });
});

// Swagger UI
app.get("/v1/swagger", swaggerUI({ url: "/v1/doc" }));

// OpenAPI docs
app.get("/v1/doc", c => {
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Akash Console Admin API",
      version: packageJson.version,
      description: "Admin API for managing Akash Console users"
    },
    servers: [{ url: "/" }],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }]
  };
  return c.json(openApiSpec);
});

// Error handler
app.onError((err, c) => {
  logger.error({ event: "APP_ERROR", error: err });
  const status = "status" in err ? (err.status as number) : 500;
  return c.json({ error: err.message || "Internal server error" }, status);
});

export { app, connectToDatabase as initDb };
