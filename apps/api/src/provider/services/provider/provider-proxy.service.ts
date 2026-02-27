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
  readonly #httpClient: HttpClient;

  constructor(@inject(PROVIDER_PROXY_HTTP_CLIENT) httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async request<T>(url: string, options: ProviderProxyPayload): Promise<T> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    const response = await this.#httpClient.post(
      "/",
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: chainNetwork,
        timeout // this is per attempt timeout on provider-proxy side
      },
      {
        ...(timeout && {
          // this is total timeout for all attempts to communicate with the provider API, and it should be much higher than per attempt timeout
          timeout: timeout * 5
        })
      }
    );
    return response.data;
  }
}
