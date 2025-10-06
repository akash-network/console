import axios from "axios";
import { singleton } from "tsyringe";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

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
  constructor(private readonly configService: DeploymentConfigService) {}

  async request<T>(url: string, options: ProviderProxyPayload): Promise<T> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    const response = await axios.post(this.configService.get("PROVIDER_PROXY_URL"), {
      ...params,
      method: options.method || "GET",
      url: providerIdentity.hostUri + url,
      providerAddress: providerIdentity.owner,
      network: chainNetwork
    });
    return response.data;
  }
}
