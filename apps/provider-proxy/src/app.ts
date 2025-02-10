import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RegExpRouter } from "hono/router/reg-exp-router";
import http from "http";
import { AddressInfo } from "net";

import { getAppStatus, statusRoute } from "./routes/getAppStatus";
import { proxyProviderRequest, proxyRoute } from "./routes/proxyProviderRequest";
import { WebsocketServer } from "./services/WebsocketServer";
import { container } from "./container";

export function createApp(): Hono {
  const app = new OpenAPIHono({ router: new RegExpRouter() });

  const corsWhitelist = [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://cloudmos.grafana.net",
    "https://console.akash.network",
    "https://staging-console.akash.network",
    "https://akashconsole.vercel.app",
    "https://console-beta.akash.network"
  ];

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

  return app;
}

export async function startAppServer(port: number): Promise<AppServer> {
  const app = createApp();
  const httpAppServer = serve({
    fetch: app.fetch,
    port
  }) as http.Server;
  const wss = new WebsocketServer(httpAppServer, container.certificateValidator, container.createWsLogger);
  wss.listen();

  return {
    host: `http://localhost:${(httpAppServer.address() as AddressInfo).port}`,
    close() {
      wss.close();
      httpAppServer.close();
    }
  };
}

export interface AppServer {
  host: string;
  close(): void;
}
