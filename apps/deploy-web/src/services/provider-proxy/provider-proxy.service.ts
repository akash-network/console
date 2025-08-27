import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import type { AxiosResponse } from "axios";

import type { ApiProviderList } from "@src/types/provider";
import type { SendManifestToProviderOptions } from "@src/utils/deploymentUtils";
import { wait } from "@src/utils/timer";

export class ProviderProxyService {
  static readonly BEFORE_SEND_MANIFEST_DELAY = 5000;

  constructor(
    private readonly axios: HttpClient,
    private readonly logger: Pick<LoggerService, "info"> = console
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

    const jsonStr = JSON.stringify(manifest, (_, value) => {
      if (typeof value !== "object" || value === null || !("quantity" in value)) return value;

      const { quantity, ...rest } = value;
      if (typeof quantity !== "object" || quantity === null || !("val" in quantity)) return value;
      return { ...rest, size: quantity };
    });

    // Waiting for provider to have lease
    await wait(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY);

    let response: AxiosResponse | undefined;

    for (let i = 1; i <= 3 && !response; i++) {
      this.logger.info(`Attempt #${i}/3 to send manifest to ${providerInfo?.owner}: PUT /deployment/${options.dseq}/manifest`);
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
          await wait(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY + 1000);
        } else {
          throw err;
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
