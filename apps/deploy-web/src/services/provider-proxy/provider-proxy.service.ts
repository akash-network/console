import { HttpService } from "@akashnetwork/http-sdk";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

export class ProviderProxyService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  fetchProviderUrl<T>(url: string, options: ProviderProxyPayload): Promise<AxiosResponse<T>> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    return this.post(
      "/",
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: options.chainNetwork
      },
      { timeout }
    );
  }
}

export interface ProviderProxyPayload {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  certPem?: string;
  keyPem?: string;
  body?: string;
  timeout?: number;
  chainNetwork: string;
  providerIdentity: ProviderIdentity;
}

export interface ProviderIdentity {
  owner: string;
  hostUri: string;
}
