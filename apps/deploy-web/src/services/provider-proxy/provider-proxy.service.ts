import type { AxiosInstance, AxiosResponse } from "axios";

import type { ApiProviderList } from "@src/types/provider";
import type { SendManifestToProviderOptions } from "@src/utils/deploymentUtils";
import { wait } from "@src/utils/timer";

export class ProviderProxyService {
  constructor(
    private readonly axios: AxiosInstance,
    private readonly logger = console
  ) {}

  fetchProviderUrl<T>(url: string, options: ProviderProxyPayload): Promise<AxiosResponse<T>> {
    const { chainNetwork, providerIdentity, timeout, ...params } = options;
    return this.axios.post(
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

  async sendManifest(providerInfo: ApiProviderList | undefined | null, manifest: unknown, options: SendManifestToProviderOptions) {
    if (!providerInfo) return;
    this.logger.info(`Sending manifest to ${providerInfo?.owner}`);

    const jsonStr = JSON.stringify(manifest).replaceAll('"quantity":{"val', '"size":{"val');

    // Waiting for provider to have lease
    await wait(5000);

    let response: AxiosResponse | undefined;

    for (let i = 1; i <= 3 && !response; i++) {
      this.logger.info(`Attempt #${i}`);
      try {
        if (!response) {
          response = await this.fetchProviderUrl(`/deployment/${options.dseq}/manifest`, {
            method: "PUT",
            certPem: options.localCert?.certPem,
            keyPem: options.localCert?.keyPem,
            body: jsonStr,
            timeout: 60_000,
            providerIdentity: providerInfo,
            chainNetwork: options.chainNetwork
          });
        }
      } catch (err) {
        if (typeof err === "string" && err.indexOf("no lease for deployment") !== -1 && i < 3) {
          this.logger.info("Lease not found, retrying...");
          await wait(6000);
        } else {
          throw new Error((err as any)?.response?.data || err);
        }
      }
    }

    // Waiting for provider to boot up workload
    await wait(5000);

    return response;
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
