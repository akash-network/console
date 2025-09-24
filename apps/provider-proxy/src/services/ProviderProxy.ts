import type { SupportedChainNetworks } from "@akashnetwork/net";
import { createHash } from "crypto";
import type { IncomingMessage, OutgoingHttpHeaders } from "http";
import type { RequestOptions } from "https";
import https from "https";
import { LRUCache } from "lru-cache";
import { TLSSocket } from "tls";
import type z from "zod";

import type { providerRequestSchema } from "../utils/schema";
import { propagateTracingContext } from "../utils/telemetry";
import type { CertificateValidator, CertValidationResultError } from "./CertificateValidator/CertificateValidator";

export class ProviderProxy {
  /**
   * Cache agents in order to control TLS session resumption
   */
  private readonly agentsCache = new LRUCache<string, https.Agent>({
    max: 1_000_000
  });

  constructor(private readonly certificateValidator: CertificateValidator) {}

  connect(url: string, options: ProxyConnectOptions): Promise<ProxyConnectionResult> {
    return new Promise<ProxyConnectionResult>((resolve, reject) => {
      const { agentCacheKey, ...requestOptions } = this.getRequestOptions(options);
      const req = https.request(
        url,
        requestOptions,
        propagateTracingContext(async (res: IncomingMessage) => {
          try {
            res.on(
              "error",
              propagateTracingContext(error => {
                resolve({ ok: false, code: "connectionError", error });
              })
            );

            const socket = res.socket;
            if (!socket || !(socket instanceof TLSSocket)) {
              res.destroy();
              return resolve({ ok: false, code: "insecureConnection" });
            }

            if (socket.authorized) {
              // CA validation is successful, so certificate is not self-signed
              resolve({ ok: true, response: res });
              return;
            }

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
              res.pause();
              const validationResult = await this.certificateValidator.validate(serverCert, options.network, options.providerAddress);

              if (validationResult.ok === false) {
                // remove agent from cache to destroy TLS session to force TLS handshake on the next call
                this.agentsCache.delete(agentCacheKey);
                resolve({ ok: false, code: "invalidCertificate", reason: validationResult.code });
                req.off("error", reject);
                res.destroy();
                req.destroy();
                requestOptions.agent?.destroy();
                return;
              }

              res.resume();
            }

            resolve({ ok: true, response: res });
          } catch (error) {
            res.destroy(error as Error);
          }
        })
      );

      if (options.signal) {
        options.signal.addEventListener(
          "abort",
          () => {
            req.destroy();
          },
          { once: true }
        );
      }

      if (!req.reusedSocket) {
        req.on(
          "error",
          propagateTracingContext(error => {
            resolve({ ok: false, code: "connectionError", error });
          })
        );
        req.on(
          "timeout",
          propagateTracingContext(() => {
            // here we are just notified that response take more than specified in request options timeout
            // then we manually destroy request and it drops connection and
            // on('error') handler is called with Error code = ECONNRESET
            req.destroy();
          })
        );
      }

      if (options.body && options.method !== "GET") req.write(options.body);
      req.end();
    });
  }

  private getRequestOptions(options: ProxyConnectOptions) {
    const requestOptions: Omit<RequestOptions, "agent" | "headers"> & { agent?: https.Agent; headers: OutgoingHttpHeaders; agentCacheKey: string } = {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      timeout: options.timeout,
      agentCacheKey: `${options.network}:${options.providerAddress}`
    };
    const agentOptions: https.AgentOptions = {
      timeout: options.timeout,
      rejectUnauthorized: false
    };

    if (options.auth?.type === "mtls") {
      requestOptions.agentCacheKey += `:${createHash("sha256").update(`${options.auth.certPem}:${options.auth.keyPem}`).digest("hex")}`;
      requestOptions.agent = this.getHttpsAgent(requestOptions.agentCacheKey, {
        ...agentOptions,
        cert: options.auth.certPem,
        key: options.auth.keyPem,
        servername: "" // disable SNI for mtls authentication
      });
    } else {
      requestOptions.agent = this.getHttpsAgent(requestOptions.agentCacheKey, agentOptions);
      if (options.auth) {
        requestOptions.headers.Authorization = `Bearer ${options.auth.token}`;
      }
    }

    return requestOptions;
  }

  private getHttpsAgent(key: string, options: https.AgentOptions): https.Agent {
    if (!this.agentsCache.has(key)) {
      const agent = new https.Agent(options);
      this.agentsCache.set(key, agent);
      return agent;
    }

    return this.agentsCache.get(key)!;
  }
}

export interface ProxyConnectOptions {
  method: string;
  auth?: z.infer<typeof providerRequestSchema>["auth"];
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  network: SupportedChainNetworks;
  timeout?: number;
  /** provider wallet address */
  providerAddress: string;
  signal?: AbortSignal;
}

export type ProxyConnectionResult = ProxyConnectionResultSuccess | ProxyConnectionResultError;

interface ProxyConnectionResultSuccess {
  ok: true;
  response: IncomingMessage;
}

type ProxyConnectionResultError =
  | { ok: false; code: "invalidCertificate"; reason: CertValidationResultError["code"] }
  | { ok: false; code: "insecureConnection" }
  | { ok: false; code: "connectionError"; error: unknown };
