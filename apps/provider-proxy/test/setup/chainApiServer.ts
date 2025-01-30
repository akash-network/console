import { X509Certificate } from "crypto";
import http from "http";
import { AddressInfo } from "net";

let chainServer: http.Server | undefined;
/**
 * Cannot mock blockchain API using nock and msw that's why have a separate server
 * @see https://github.com/mswjs/msw/discussions/2416
 */
export function mockOnChainCertificates(certificates: X509Certificate[], options?: ChainApiOptions) {
  let isRespondedWithCustomStatus = false;
  return new Promise<http.Server>(resolve => {
    const server = http.createServer((req, res) => {
      if (options?.respondWithOnceWith && !isRespondedWithCustomStatus) {
        isRespondedWithCustomStatus = true;
        res.writeHead(options?.respondWithOnceWith);
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

      res.writeHead(200, "OK");
      res.end(
        JSON.stringify({
          certificates: certificates
            .filter(cert => cert.serialNumber === serialNumber)
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
  respondWithOnceWith?: number;
}
