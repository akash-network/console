import { RequestListener } from "http";
import https, { ServerOptions } from "https";
import { AddressInfo } from "net";
import { setTimeout } from "timers/promises";

import { CertPair } from "../seeders/createX509CertPair";

let runningServer: https.Server | undefined;

export function startProviderServer(pair: CertPair): Promise<string> {
  return new Promise<string>(resolve => {
    const options: ServerOptions = {
      key: pair.key,
      cert: pair.cert.toJSON()
    };

    const state: Record<string, any> = {};
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
          await setTimeout(1000);
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

    const server = https.createServer(options, (req, res) => {
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
  });
}

export function stopProviderServer() {
  runningServer?.close();
}
