import http from "http";
import type { AddressInfo } from "net";

import { shutdownServer } from "../../src/utils/shutdownServer";

let inventoryServer: http.Server | undefined;

export function startProviderInventoryApiServer(hostUrisByOwner: Record<string, string>): Promise<{ url: string }> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const providerLookup = /^\/v1\/providers\/([^/?]+)$/.exec(req.url || "");
      const owner = providerLookup ? decodeURIComponent(providerLookup[1]) : undefined;
      const hostUri = owner ? hostUrisByOwner[owner] : undefined;

      if (!hostUri) {
        res.writeHead(404, { Connection: "close" });
        res.end();
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
      res.end(JSON.stringify({ owner, hostUri, isOnline: true, reclamationWindow: null }));
    });

    server.listen(0, () => {
      inventoryServer = server;
      resolve({ url: `http://localhost:${(server.address() as AddressInfo).port}` });
    });
  });
}

export function stopProviderInventoryApiServer(): Promise<void> {
  return shutdownServer(inventoryServer);
}
