import { RequestListener } from "http";
import https, { ServerOptions } from "https";
import { AddressInfo } from "net";
import { setTimeout } from "timers/promises";
import WebSocket from "ws";

import { CertPair, createX509CertPair } from "../seeders/createX509CertPair";

let runningServer: https.Server | undefined;

export function startProviderServer(options: ProviderServerOptions): Promise<string> {
  return new Promise<string>(resolve => {
    const certPair = options.certPair || createX509CertPair();
    const httpServerOptions: ServerOptions = {
      key: certPair.key,
      cert: certPair.cert.toJSON()
    };

    const state: Record<string, boolean> = {};
    const handlers: Record<string, RequestListener> = {
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
      async "/slow-once"(_, res) {
        if (!state.wasSlow) {
          state.wasSlow = true;
          await setTimeout(1000, null, { ref: false });
          res.writeHead(200);
          res.end("Slow");
          return;
        }

        res.writeHead(200, "OK", { "Content-Type": "text/plain" });
        res.end("Fast");
      },
      "/5xx-once"(_, res) {
        if (!state.returned5xx) {
          state.returned5xx = true;
          res.writeHead(502);
          res.end();
          return;
        }

        res.writeHead(200, "OK", { "Content-Type": "text/plain" });
        res.end("Success");
      }
    };

    const server = https.createServer(httpServerOptions, (req, res) => {
      if (req.url && Object.hasOwn(handlers, req.url)) {
        handlers[req.url](req, res);
      } else {
        res.writeHead(404, "Not found", { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.listen(0, () => {
      runningServer = server;
      resolve(`https://localhost:${(server.address() as AddressInfo).port}`);
    });

    if (options.websocketServer?.enable) {
      const wss = new WebSocket.Server({ noServer: true });
      server.on("upgrade", (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, socket => {
          wss.emit("connection", socket, request);
        });
      });
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

export interface ProviderServerOptions {
  certPair?: CertPair;
  websocketServer?: {
    enable: boolean;
    onConnection?(ws: WebSocket): void;
  };
}
