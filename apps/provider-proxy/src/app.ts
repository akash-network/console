import cors from "cors";
import express, { Express } from "express";
import { AddressInfo } from "net";

import { getAppStatus } from "./routes/getAppStatus";
import { proxyProviderRequest } from "./routes/proxyProviderRequest";
import { WebsocketServer } from "./services/WebsocketServer";
import { container } from "./container";

export function createApp(): Express {
  const app = express();

  const whitelist = [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://cloudmos.grafana.net",
    "https://console.akash.network",
    "https://staging-console.akash.network",
    "https://akashconsole.vercel.app",
    "https://console-beta.akash.network"
  ];

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || whitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          container.httpLogger?.warn(`Cors refused: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      }
    })
  );
  app.use(express.json());
  app.get("/status", getAppStatus);
  app.post("/", proxyProviderRequest);

  return app;
}

export async function startAppServer(port: number): Promise<AppServer> {
  return new Promise(resolve => {
    const app = createApp();
    const httpAppServer = app.listen(port, () => {
      resolve({
        host: `http://localhost:${(httpAppServer.address() as AddressInfo).port}`,
        close() {
          wss.close();
          httpAppServer.close();
        }
      });
    });
    const wss = WebsocketServer.from(httpAppServer, container.wsLogger).listen();
  });
}

export interface AppServer {
  host: string;
  close(): void;
}
