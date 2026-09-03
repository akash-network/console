import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";
import type { IncomingMessage, OutgoingHttpHeaders } from "node:http";
import type { RequestOptions } from "node:https";
import https from "node:https";
import { TLSSocket } from "node:tls";
import type { z } from "zod";

import type { NetworkLookup } from "../utils/createForbidPrivateNetworkLookup/createForbidPrivateNetworkLookup";
import { toErrno } from "../utils/errno";
import type { providerRequestSchema } from "../utils/schema";
import { propagateTracingContext } from "../utils/telemetry";
import type { CertificateValidator, CertValidationResultError } from "./CertificateValidator/CertificateValidator";
import type { ProviderConnectionTracker } from "./ProviderConnectionTracker/ProviderConnectionTracker";

export class ProviderProxy {
  /**
   * Cache agents in order to control TLS session resumption
   */
  readonly #agentsCache = new LRUCache<string, https.Agent>({
    max: 1_000_000
  });
  /** Destroying a shared agent aborts every concurrent dial to that provider with ECONNRESET, which must not count as the provider being unreachable. */
  readonly #tornDownAgents = new WeakSet<https.Agent>();
  readonly #certificateValidator: CertificateValidator;
  readonly #networkLookup?: NetworkLookup;
  readonly #connectionTracker?: ProviderConnectionTracker;

  constructor(certificateValidator: CertificateValidator, networkLookup?: NetworkLookup, connectionTracker?: ProviderConnectionTracker) {
    this.#certificateValidator = certificateValidator;
    this.#networkLookup = networkLookup;
    this.#connectionTracker = connectionTracker;
  }

  connect(url: string, options: ProxyConnectOptions): Promise<ProxyConnectionResult> {
    const trackerKey = this.getTrackerKey(url, options);

    if (trackerKey && this.#connectionTracker?.shouldSkipDial(trackerKey)) {
      return Promise.resolve({
        ok: false,
        code: "connectionError",
        error: this.#connectionTracker.getLastError(trackerKey),
        shortCircuited: true
      });
    }

    return new Promise<ProxyConnectionResult>((resolve, reject) => {
      let selfDestroyed = false;
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
              this.recordReachable(trackerKey);
              res.destroy();
              return resolve({ ok: false, code: "insecureConnection" });
            }

            this.recordReachable(trackerKey);

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

            if (didHandshake && options.providerAddress) {
              res.pause();
              const validationResult = await this.#certificateValidator.validate(serverCert, options.providerAddress);

              if (validationResult.ok === false) {
                // remove agent from cache to destroy TLS session to force TLS handshake on the next call
                this.#agentsCache.delete(agentCacheKey);
                resolve({ ok: false, code: "invalidCertificate", reason: validationResult.code });
                req.off("error", reject);
                selfDestroyed = true;
                res.destroy();
                req.destroy();
                if (requestOptions.agent) this.#tornDownAgents.add(requestOptions.agent);
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
            selfDestroyed = true;
            req.destroy();
          },
          { once: true }
        );
      }

      if (!req.reusedSocket) {
        req.on(
          "error",
          propagateTracingContext(error => {
            const destroyedByProxy = selfDestroyed || (requestOptions.agent !== undefined && this.#tornDownAgents.has(requestOptions.agent));
            if (!destroyedByProxy) this.recordUnreachable(trackerKey, error);
            resolve({ ok: false, code: "connectionError", error });
          })
        );
        req.on(
          "timeout",
          propagateTracingContext(() => {
            selfDestroyed = true;
            req.destroy();
          })
        );
      }

      if (options.body && options.method !== "GET") req.write(options.body);
      req.end();
    });
  }

  /**
   * Keyed by provider and dial target together so a provider that re-registers a new hostUri does not
   * inherit the dead host's cooldown. The mTLS cert hash is deliberately left out, unlike the agent cache
   * key, because whether a host answers has nothing to do with which credentials are presented.
   */
  private getTrackerKey(url: string, options: ProxyConnectOptions): string | undefined {
    if (!this.#connectionTracker || !options.providerAddress) return undefined;

    return `${options.providerAddress}|${new URL(url).origin}`;
  }

  private recordReachable(trackerKey: string | undefined): void {
    if (trackerKey) this.#connectionTracker?.recordReachable(trackerKey);
  }

  private recordUnreachable(trackerKey: string | undefined, error: unknown): void {
    if (trackerKey) this.#connectionTracker?.recordUnreachable(trackerKey, error, toErrno(error));
  }

  private getRequestOptions(options: ProxyConnectOptions) {
    const requestOptions: Omit<RequestOptions, "agent" | "headers"> & { agent?: https.Agent; headers: OutgoingHttpHeaders; agentCacheKey: string } = {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      timeout: options.timeout,
      agentCacheKey: options.providerAddress
    };
    const agentOptions: https.AgentOptions = {
      timeout: options.timeout,
      rejectUnauthorized: false,
      lookup: this.#networkLookup
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
    if (!this.#agentsCache.has(key)) {
      const agent = new https.Agent(options);
      this.#agentsCache.set(key, agent);
      return agent;
    }

    return this.#agentsCache.get(key)!;
  }
}

export interface ProxyConnectOptions {
  method: string;
  auth?: z.infer<typeof providerRequestSchema>["auth"];
  body?: RequestInit["body"];
  headers?: Record<string, string>;
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
  | { ok: false; code: "connectionError"; error: unknown; shortCircuited?: true };
