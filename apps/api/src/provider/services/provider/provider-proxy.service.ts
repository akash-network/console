import axios from "axios";
import https from "https";
import { singleton } from "tsyringe";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

export interface ProviderIdentity {
  owner: string;
  hostUri: string;
}

export interface ProviderProxyPayload {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  certPem?: string;
  keyPem?: string;
  body?: string;
  timeout?: number;
  chainNetwork: string;
  providerIdentity: ProviderIdentity;
  headers?: Record<string, string>;
}

@singleton()
export class ProviderProxyService {
  private readonly proxyUrl: string;

  constructor(private readonly configService: DeploymentConfigService) {
    const proxyUrl = this.configService.get("PROVIDER_PROXY_URL");
    if (!proxyUrl) {
      throw new Error("PROVIDER_PROXY_URL environment variable is not set");
    }
    this.proxyUrl = proxyUrl;
  }

  async fetchProviderUrl<T>(url: string, options: ProviderProxyPayload): Promise<T> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    const response = await axios.post(
      this.proxyUrl,
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: chainNetwork
      },
      {
        timeout,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      }
    );
    return response.data;
  }
}
