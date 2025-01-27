import { SupportedChainNetworks } from "@akashnetwork/net";
import { X509Certificate } from "crypto";
import { IncomingMessage } from "http";
import https, { RequestOptions } from "https";
import { LRUCache } from "lru-cache";
import { TLSSocket } from "tls";

import { CertValidationResultError, validateCertificate } from "../utils/validateCertificate";
import { ProviderService } from "./ProviderService";

export class ProviderProxy {
  private readonly knownCertificatesCache = new LRUCache<string, boolean>({
    max: 100_000,
    ttl: 30 * 60 * 1000
  });

  constructor(
    private readonly now: () => number,
    private readonly providerService: ProviderService
  ) {}

  connect(url: string, options: ProxyConnectOptions): Promise<ProxyConnectionResult> {
    return new Promise<ProxyConnectionResult>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...options.headers
          },
          timeout: options.timeout,
          cert: options.cert,
          key: options.key,
          rejectUnauthorized: false
        },
        async res => {
          try {
            res.setEncoding("utf8");
            const socket = res.socket as TLSSocket;
            const serverCert = socket.getPeerX509Certificate();
            // @see https://nodejs.org/api/tls.html#session-resumption
            // for servers which support TLS session resumption, handshake phase is skipped for subsequent requests
            // to improve performance and in this case certicate is not available because it is not requested.
            // There is a way to disable session resumption but it will hurt performance.
            // To disable either create a new `https.Agent` for every request or reduce session related options in it
            // sessionTimeout & maxCachedSessions. In that case, we will do TLS handshake on every request and
            // will receive certificate for every request
            const didHandshake = !!serverCert;

            if (didHandshake && options.network && options.providerAddress) {
              const validationResult = validateCertificate(serverCert, this.now());
              if (validationResult.ok === false) {
                req.destroy();
                return resolve({ ok: false, code: "invalidCertificate", reason: validationResult.code });
              }

              const isKnown = await this.isKnownCertificate(serverCert, options.network, options.providerAddress);
              if (!isKnown) {
                req.destroy();
                return resolve({ ok: false, code: "invalidCertificate", reason: "unknownCertificate" });
              }
            }

            resolve({ ok: true, response: res });
          } catch (error) {
            reject(error);
          }
        }
      );

      if (!req.reusedSocket) {
        req.on("error", (error: (Error & { code: string }) | undefined) => {
          reject(error);
        });
        req.on("timeout", () => {
          // here we are just notified that response take more than specified in request options timeout
          // then we manually destroy request and it drops connection and
          // on('error') handler is called with Error code = ECONNRESET
          req.destroy();
        });
      }

      if (options.body) req.write(options.body);
      req.end();
    });
  }

  private async isKnownCertificate(cert: X509Certificate, network: SupportedChainNetworks, providerAddress: string): Promise<boolean> {
    const key = `${network}.${providerAddress}.${cert.serialNumber}`;

    if (!this.knownCertificatesCache.has(key)) {
      const hasCertificate = await this.providerService.hasCertificate(network, providerAddress, cert.serialNumber);
      this.knownCertificatesCache.set(key, hasCertificate);
      return hasCertificate;
    }

    return this.knownCertificatesCache.get(key);
  }
}

export interface ProxyConnectOptions extends Pick<RequestOptions, "cert" | "key" | "method"> {
  body?: BodyInit;
  headers?: Record<string, string>;
  network: SupportedChainNetworks;
  timeout?: number;
  /** provider wallet address */
  providerAddress: string;
}

export type ProxyConnectionResult = ProxyConnectionResultSuccess | ProxyConnectionResultError;

interface ProxyConnectionResultSuccess {
  ok: true;
  response: IncomingMessage;
}

type ProxyConnectionResultError = { ok: false; code: "invalidCertificate"; reason: CertValidationResultError["code"] | "unknownCertificate" };
