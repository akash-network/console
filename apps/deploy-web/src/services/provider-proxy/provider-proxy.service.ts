import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { NetConfig } from "@akashnetwork/net";
import type { AxiosResponse } from "axios";

import type { ApiProviderList } from "@src/types/provider";
import { wait } from "@src/utils/timer";

export class ProviderProxyService {
  static readonly BEFORE_SEND_MANIFEST_DELAY = 5000;

  constructor(
    private readonly axios: HttpClient,
    private readonly logger: Pick<LoggerService, "info"> = console,
    private readonly netConfig: NetConfig = new NetConfig()
  ) {}

  fetchProviderUrl<T>(url: string, options: ProviderProxyPayload): Promise<AxiosResponse<T>> {
    const { chainNetwork, providerIdentity, timeout, credentials, ...params } = options;
    return this.axios.post(
      "/",
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: this.netConfig.mapped(options.chainNetwork),
        auth: credentials ? providerCredentialsToApiCredentials(credentials) : undefined
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
            credentials: options.credentials,
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
  credentials?: ProviderCredentials | null;
  body?: string;
  timeout?: number;
  chainNetwork: string;
  providerIdentity: ProviderIdentity;
}

export interface ProviderIdentity {
  owner: string;
  hostUri: string;
}

export interface SendManifestToProviderOptions {
  dseq: string;
  credentials?: ProviderCredentials | null;
  chainNetwork: string;
}

export type ProviderCredentials =
  | {
      type: "mtls";
      value:
        | {
            cert: string;
            key: string;
          }
        | null
        | undefined;
    }
  | {
      type: "jwt";
      value: string | undefined | null;
    };

export type ProviderApiCredentials =
  | {
      type: "mtls";
      certPem: string;
      keyPem: string;
    }
  | {
      type: "jwt";
      token: string;
    };
export function providerCredentialsToApiCredentials(credentials: ProviderCredentials | null | undefined): ProviderApiCredentials | undefined {
  if (!credentials?.value) return;
  if (credentials.type === "mtls")
    return {
      type: credentials.type,
      certPem: credentials.value.cert,
      keyPem: credentials.value.key
    };
  return {
    type: credentials.type,
    token: credentials.value
  };
}
