import type { IncomingMessage, ServerResponse } from "http";
import type { ServerOptions } from "https";
import https from "https";
import type { AddressInfo } from "net";
import WebSocket from "ws";

import type { CertPair } from "../seeders/createX509CertPair";
import { createX509CertPair } from "../seeders/createX509CertPair";

let runningServer: https.Server | undefined;

export function startProviderServer(options: ProviderServerOptions): Promise<string> {
  return new Promise<string>(resolve => {
    const certPair = options.certPair || createX509CertPair();
    const httpServerOptions: ServerOptions = {
      key: certPair.key,
      cert: certPair.cert.toJSON()
    };

    let cleanupHandlers = new Set<() => void>();
    const handlers: RequestHandlers = {
      "/200.txt"(_, res) {
        res.writeHead(200, "OK", { "Content-Type": "text/plain" });
        res.end("Hello, World!");
      },
      "/headers.json"(_, res) {
        res.writeHead(200, "OK", {
          "Content-Type": "application/json",
          "X-Custom-Header": "test"
        });
        res.end(JSON.stringify({ ok: true }));
      },
      ...options.handlers
    };

    const server = https.createServer(httpServerOptions, (req, res) => {
      if (req.url && Object.hasOwn(handlers, req.url)) {
        const cleanup = handlers[req.url](req, res);
        if (cleanup) cleanupHandlers.add(cleanup);
      } else {
        res.writeHead(404, "Not found", { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.on("close", () => {
      cleanupHandlers.forEach(handler => handler());
      cleanupHandlers = new Set();
    });

    server.listen(0, () => {
      runningServer = server;
      resolve(`https://localhost:${(server.address() as AddressInfo).port}`);
    });

    if (options.websocketServer?.enable) {
      const wss = new WebSocket.Server({ server });
      server.on("close", () => wss.close());
      if (options.websocketServer.onConnection) {
        wss.on("connection", options.websocketServer.onConnection);
      }
    }
  });
}

export function stopProviderServer() {
  runningServer?.close();
}

type RequestHandlers = Record<string, (req: IncomingMessage, res: ServerResponse) => (() => void) | undefined | void>;
export interface ProviderServerOptions {
  certPair?: CertPair;
  handlers?: RequestHandlers;
  websocketServer?: {
    enable: boolean;
    onConnection?(ws: WebSocket): void;
  };
}
