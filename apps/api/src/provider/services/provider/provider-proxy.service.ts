import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { PROVIDER_PROXY_HTTP_CLIENT } from "@src/provider/providers/provider-proxy.provider";

export interface ProviderIdentity {
  owner: string;
  hostUri: string;
}

export type ProviderMtlsAuth = {
  type: "mtls";
  certPem: string;
  keyPem: string;
};

export type ProviderAuth =
  | ProviderMtlsAuth
  | {
      type: "jwt";
      token: string;
    };

export interface ProviderProxyPayload {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  timeout?: number;
  chainNetwork: string;
  providerIdentity: ProviderIdentity;
  headers?: Record<string, string>;
  auth: ProviderAuth;
}

@singleton()
export class ProviderProxyService {
  readonly #PROVIDER_PROXY_MAX_TIMEOUT = 30_000;
  readonly #httpClient: HttpClient;

  constructor(@inject(PROVIDER_PROXY_HTTP_CLIENT) httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async request<T>(url: string, options: ProviderProxyPayload): Promise<T> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    const proxyTimeout = timeout ? Math.min(timeout, this.#PROVIDER_PROXY_MAX_TIMEOUT) : undefined;
    const response = await this.#httpClient.post(
      "/",
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: chainNetwork,
        ...(proxyTimeout && { timeout: proxyTimeout })
      },
      { ...(proxyTimeout && { timeout: proxyTimeout }) }
    );
    return response.data;
  }
}
