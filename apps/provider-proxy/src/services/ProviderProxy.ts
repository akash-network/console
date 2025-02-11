import { SupportedChainNetworks } from "@akashnetwork/net";
import { IncomingMessage } from "http";
import https, { RequestOptions } from "https";
import { LRUCache } from "lru-cache";
import { TLSSocket } from "tls";

import { CertificateValidator, CertValidationResultError } from "./CertificateValidator";

export class ProviderProxy {
  /**
   * Cache agents in order to control TLS session resumption
   */
  private readonly agentsCache = new LRUCache<string, https.Agent>({
    max: 1_000_000
  });

  constructor(private readonly certificateValidator: CertificateValidator) {}

  connect(url: string, options: ProxyConnectOptions): Promise<ProxyConnectionResult> {
    const agentOptions: TLSChainAgentOptions = {
      timeout: options.timeout,
      rejectUnauthorized: false,
      cert: options.cert,
      key: options.key,
      chainNetwork: options.network,
      providerAddress: options.providerAddress
    };
    const agent = this.getHttpsAgent(agentOptions);
    return new Promise<ProxyConnectionResult>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...options.headers
          },
          agent
        },
        async res => {
          try {
            const socket = res.socket;
            if (!socket || !(socket instanceof TLSSocket)) {
              return resolve({ ok: false, code: "insecureConnection" });
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
              const validationResult = await this.certificateValidator.validate(serverCert, options.network, options.providerAddress);
              if (validationResult.ok === false) {
                // remove agent from cache to destroy TLS session to force TLS handshake on the next call
                this.agentsCache.delete(genAgentsCacheKey(agentOptions));
                resolve({ ok: false, code: "invalidCertificate", reason: validationResult.code });
                req.off("error", reject);
                req.destroy();
                agent.destroy();
                return;
              }
            }

            resolve({ ok: true, response: res });
          } catch (error) {
            reject(error);
          }
        }
      );

      if (!req.reusedSocket) {
        req.on("error", reject);
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

  private getHttpsAgent(options: TLSChainAgentOptions): https.Agent {
    const key = genAgentsCacheKey(options);

    if (!this.agentsCache.has(key)) {
      const { chainNetwork, providerAddress, ...agentOptions } = options;
      const agent = new https.Agent(agentOptions);
      this.agentsCache.set(key, agent);
      return agent;
    }

    return this.agentsCache.get(key);
  }
}

function genAgentsCacheKey(options: TLSChainAgentOptions): string {
  return `${options.chainNetwork}:${options.providerAddress}:${options.cert}:${options.key}`;
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

type ProxyConnectionResultError =
  | { ok: false; code: "invalidCertificate"; reason: CertValidationResultError["code"] }
  | { ok: false; code: "insecureConnection" };

interface TLSChainAgentOptions extends https.AgentOptions {
  chainNetwork: SupportedChainNetworks;
  providerAddress: string;
}
