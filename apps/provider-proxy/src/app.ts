import { serve } from "@hono/node-server";
import { otel } from "@hono/otel";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import { RegExpRouter } from "hono/router/reg-exp-router";
import type http from "http";
import type { AddressInfo } from "net";

import { getAppStatus, statusRoute } from "./routes/getAppStatus";
import { proxyProviderRequest, proxyRoute } from "./routes/proxyProviderRequest";
import { HonoErrorHandlerService } from "./services/HonoErrorHandlerService/HonoErrorHandlerService";
import { WebsocketServer } from "./services/WebsocketServer";
import type { AppEnv } from "./types/AppContext";
import { shutdownServer } from "./utils/shutdownServer";
import type { Container } from "./container";
import { createContainer } from "./container";

export function createApp(container: Container): Hono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({ router: new RegExpRouter() });

  const corsWhitelist = [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://console.akash.network",
    "https://staging-console.akash.network",
    "https://akashconsole.vercel.app",
    "https://console-beta.akash.network"
  ];

  app.use("*", otel());
  app.use((c, next) => {
    c.set("container", container);
    return next();
  });
  app.use(container.httpLoggerInterceptor.intercept());
  app.use(
    "/*",
    cors({
      allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
      origin: corsWhitelist,
      maxAge: 60
    })
  );
  app.openapi(statusRoute, getAppStatus);
  app.openapi(proxyRoute, proxyProviderRequest as any);
  app.onError(new HonoErrorHandlerService().handle);

  return app;
}

export async function startAppServer(port: number): Promise<AppServer> {
  const container = createContainer();
  const app = createApp(container);
  const httpAppServer = serve({
    fetch: app.fetch,
    port
  }) as http.Server;
  const wss = new WebsocketServer(httpAppServer, container.certificateValidator, container.wsStats, container.wsLogger);
  wss.listen();

  return {
    host: `http://localhost:${(httpAppServer.address() as AddressInfo).port}`,
    container,
    async close() {
      await Promise.all([shutdownServer(wss), shutdownServer(httpAppServer)]);
    }
  };
}

export interface AppServer {
  host: string;
  container: Container;
  close(): Promise<void>;
}
