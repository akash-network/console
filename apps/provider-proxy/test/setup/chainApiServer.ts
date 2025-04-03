import { bech32 } from "bech32";
import type { X509Certificate } from "crypto";
import http from "http";
import type { AddressInfo } from "net";

let chainServer: http.Server | undefined;
/**
 * Cannot mock blockchain API using nock and msw that's why have a separate server
 * @see https://github.com/mswjs/msw/discussions/2416
 */
export function startChainApiServer(certificates: X509Certificate[], options?: ChainApiOptions) {
  let isRespondedWithCustomStatus = false;
  return new Promise<http.Server>(resolve => {
    const server = http.createServer((req, res) => {
      if (options?.respondOnceWith && !isRespondedWithCustomStatus) {
        isRespondedWithCustomStatus = true;
        res.writeHead(options?.respondOnceWith);
        res.end();
        return;
      }

      if (!req.url?.includes("/akash/cert/v1beta3/certificates/list")) {
        res.writeHead(404, "Not Found");
        res.end("");
        return;
      }

      const url = new URL(`http://localhost${req.url || "/"}`);
      const serialNumber = BigInt(url.searchParams.get("filter.serial")!).toString(16).toUpperCase();
      const providerAddress = url.searchParams.get("filter.owner")!;

      res.writeHead(200, "OK");
      res.end(
        JSON.stringify({
          certificates: certificates
            .filter(cert => cert.serialNumber === serialNumber && cert.toLegacyObject().subject.CN === providerAddress)
            .map(cert => ({
              serial: BigInt(`0x${cert.serialNumber}`).toString(10),
              certificate: {
                cert: btoa(cert.toJSON()),
                pubkey: cert.publicKey.export({ type: "pkcs1", format: "pem" })
              }
            }))
        })
      );
    });

    server.listen(0, () => {
      chainServer = server;
      process.env.TEST_CHAIN_NETWORK_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
      resolve(server);
    });
  });
}

export function stopChainAPIServer(): void {
  chainServer?.close();
}

export interface ChainApiOptions {
  respondOnceWith?: number;
}

let index = 0;
export function generateBech32() {
  const words = bech32.toWords(Buffer.from("foobar2", "utf8"));
  return bech32.encode(`test${++index}`, words);
}
