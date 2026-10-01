import { toBech32 } from "@cosmjs/encoding";
import type { X509Certificate } from "crypto";
import http from "http";
import type { AddressInfo } from "net";

import { shutdownServer } from "../../src/utils/shutdownServer";

let chainServer: http.Server | undefined;
const registeredHosts = new Map<string, string>();

export function registerProviderHost(providerAddress: string, hostUri: string): void {
  registeredHosts.set(providerAddress, hostUri);
}

/**
 * Cannot mock blockchain API using nock and msw that's why have a separate server
 * @see https://github.com/mswjs/msw/discussions/2416
 */
export function startChainApiServer(
  certificates: X509Certificate[],
  options?: ChainApiOptions
): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (options?.interceptRequest?.(req, res)) return;

      const providerLookup = /\/akash\/provider\/v1beta4\/providers\/([^/?]+)/.exec(req.url || "");
      if (providerLookup) {
        respondWithProvider(res, providerLookup[1]);
        return;
      }

      if (!/\/akash\/cert\/v1\/certificates\/list/.test(req.url || "")) {
        res.writeHead(404, { Connection: "close" });
        res.end("");
        return;
      }

      const url = new URL(`http://localhost${req.url || "/"}`);
      const serialNumber = BigInt(url.searchParams.get("filter.serial")!).toString(16).toUpperCase();
      const providerAddress = url.searchParams.get("filter.owner")!;

      res.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
      res.end(
        JSON.stringify({
          certificates: certificates
            .filter(cert => cert.serialNumber === serialNumber && cert.toLegacyObject().subject.CN === providerAddress)
            .map(cert => ({
              serial: BigInt(`0x${cert.serialNumber}`).toString(10),
              certificate: {
                cert: btoa(cert.toJSON()),
                pubkey: cert.publicKey.export({ type: "spki", format: "pem" })
              }
            }))
        })
      );
    });

    server.listen(options?.port ?? 0, () => {
      chainServer = server;
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}`,
        close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))
      });
    });
  });
}

function respondWithProvider(res: http.ServerResponse, providerAddress: string): void {
  const hostUri = registeredHosts.get(providerAddress);

  if (!hostUri) {
    res.writeHead(404, { "Content-Type": "application/json", Connection: "close" });
    res.end(JSON.stringify({ code: 5, message: "codespace provider code 3: invalid provider: address not found", details: [] }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
  res.end(JSON.stringify({ provider: { owner: providerAddress, host_uri: hostUri, attributes: [] } }));
}

export function stopChainAPIServer(): Promise<void> {
  registeredHosts.clear();
  return shutdownServer(chainServer);
}

export interface ChainApiOptions {
  port?: number;
  interceptRequest?(req: http.IncomingMessage, res: http.ServerResponse): boolean;
}

let index = 0;
export function generateBech32(): string {
  return toBech32("akash", Buffer.from(`test${++index}`, "utf8"));
}
