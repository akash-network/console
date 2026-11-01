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
import type { CertificateValidator } from "./CertificateValidator/CertificateValidator";
import {
  ProviderCertificateAgent,
  type ProviderCertificateAgentOptions,
  ProviderCertificateRejectedError,
  type ProviderCertificateRejection
} from "./ProviderCertificateAgent/ProviderCertificateAgent";
import type { ProviderConnectionTracker } from "./ProviderConnectionTracker/ProviderConnectionTracker";

export class ProviderProxy {
  /**
   * Cache agents in order to control TLS session resumption
   */
  readonly #agentsCache = new LRUCache<string, ProviderCertificateAgent>({
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

    return new Promise<ProxyConnectionResult>(resolve => {
      let proxyTermination: DialTermination | undefined;
      /** Node's timeout option measures socket inactivity, so a provider dribbling bytes can hold a dial open indefinitely; this bounds it by elapsed time instead. */
      let dialDeadline: NodeJS.Timeout | undefined;
      const stopDialDeadline = () => clearTimeout(dialDeadline);
      const { agentCacheKey, ...requestOptions } = this.getRequestOptions(options);
      const req = https.request(
        url,
        requestOptions,
        propagateTracingContext((res: IncomingMessage) => {
          proxyTermination ??= "providerAnswered";
          stopDialDeadline();

          res.on(
            "error",
            propagateTracingContext(error => {
              resolve({ ok: false, code: "connectionError", error });
            })
          );

          this.recordReachable(trackerKey);

          if (!(res.socket instanceof TLSSocket)) {
            res.destroy();
            return resolve({ ok: false, code: "insecureConnection" });
          }

          resolve({ ok: true, response: res });
        })
      );
      const terminationOnTimeout = (): DialTermination => (requestOptions.agent.isVerifying(req.socket) ? "verifyingCertificate" : "attemptTimedOut");

      if (options.signal) {
        options.signal.addEventListener(
          "abort",
          () => {
            proxyTermination ??= "clientAborted";
            req.destroy();
          },
          { once: true }
        );
      }

      if (options.timeout) {
        dialDeadline = setTimeout(
          propagateTracingContext(() => {
            proxyTermination ??= terminationOnTimeout();
            req.destroy();
          }),
          options.timeout
        );
        req.once("close", stopDialDeadline);
      }

      req.on(
        "error",
        propagateTracingContext(error => {
          if (error instanceof ProviderCertificateRejectedError) {
            this.recordReachable(trackerKey);
            if (error.code === "serverError") return resolve({ ok: false, code: "connectionError", error: error.cause });

            this.#tearDownAgent(agentCacheKey, requestOptions.agent);
            return resolve({ ok: false, code: "invalidCertificate", reason: error.code });
          }

          const tornDownAgent = this.#tornDownAgents.has(requestOptions.agent);
          const termination = proxyTermination ?? (tornDownAgent ? "agentTornDown" : undefined);

          if (this.recordDialFailure(trackerKey, error, termination)) {
            return resolve({ ok: false, code: "connectionError", error, repeatedFailure: true });
          }

          resolve({ ok: false, code: "connectionError", error });
        })
      );
      req.on(
        "timeout",
        propagateTracingContext(() => {
          proxyTermination ??= terminationOnTimeout();
          req.destroy();
        })
      );

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

  /** Of the dials the proxy kills itself only a timed-out one says anything about the host, so the rest are recorded as nothing at all. */
  private recordDialFailure(trackerKey: string | undefined, error: unknown, termination: DialTermination | undefined): boolean {
    if (!trackerKey || !this.#connectionTracker) return false;

    if (termination === "attemptTimedOut") {
      this.#connectionTracker.recordUnresponsive(trackerKey, error);
      return this.#connectionTracker.hasRepeatedFailures(trackerKey);
    }

    if (termination) return false;

    const errno = toErrno(error);
    this.#connectionTracker.recordUnreachable(trackerKey, error, errno);

    return this.#connectionTracker.isRepeatedFailure(trackerKey, errno);
  }

  private getRequestOptions(options: ProxyConnectOptions) {
    const requestOptions: Omit<RequestOptions, "agent" | "headers"> & { headers: OutgoingHttpHeaders; agentCacheKey: string } = {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      timeout: options.timeout,
      agentCacheKey: options.providerAddress
    };
    const agentOptions: ProviderCertificateAgentOptions = {
      timeout: options.timeout,
      rejectUnauthorized: false,
      lookup: this.#networkLookup,
      certificateValidator: this.#certificateValidator,
      providerAddress: options.providerAddress
    };

    if (options.auth?.type === "mtls") {
      requestOptions.agentCacheKey += `:${createHash("sha256").update(`${options.auth.certPem}:${options.auth.keyPem}`).digest("hex")}`;
      const agent = this.getHttpsAgent(requestOptions.agentCacheKey, {
        ...agentOptions,
        cert: options.auth.certPem,
        key: options.auth.keyPem,
        servername: "" // disable SNI for mtls authentication
      });
      return { ...requestOptions, agent };
    }

    if (options.auth) {
      requestOptions.headers.Authorization = `Bearer ${options.auth.token}`;
    }

    return { ...requestOptions, agent: this.getHttpsAgent(requestOptions.agentCacheKey, agentOptions) };
  }

  private getHttpsAgent(key: string, options: ProviderCertificateAgentOptions): ProviderCertificateAgent {
    if (!this.#agentsCache.has(key)) {
      const agent = new ProviderCertificateAgent(options);
      this.#agentsCache.set(key, agent);
      return agent;
    }

    return this.#agentsCache.get(key)!;
  }

  /** A failed check drops the agent and every session it cached for that provider, so each later call starts with a full handshake that is checked again. */
  #tearDownAgent(key: string, agent: ProviderCertificateAgent): void {
    this.#agentsCache.delete(key);
    this.#tornDownAgents.add(agent);
    agent.destroy();
  }
}

/** providerAnswered is recorded first so that anything killing the dial afterwards cannot be read back as the host having failed to answer, and verifyingCertificate does the same for a timeout that fires while the host's certificate is still being checked. */
type DialTermination = "providerAnswered" | "clientAborted" | "attemptTimedOut" | "verifyingCertificate" | "agentTornDown";

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
  | { ok: false; code: "invalidCertificate"; reason: ProviderCertificateRejection }
  | { ok: false; code: "insecureConnection" }
  | { ok: false; code: "connectionError"; error: unknown; shortCircuited?: true; repeatedFailure?: true };
