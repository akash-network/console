import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

import type { BrowserEnvConfig, ServerEnvConfig } from "@/config/env-config.schema";

export class ApiUrlService {
  constructor(
    private readonly config:
      | Pick<ServerEnvConfig, "BASE_API_MAINNET_URL" | "BASE_API_TESTNET_URL" | "BASE_API_SANDBOX_URL" | "PROXY_API_URL">
      | Pick<
          BrowserEnvConfig,
          "NEXT_PUBLIC_BASE_API_TESTNET_URL" | "NEXT_PUBLIC_BASE_API_SANDBOX_URL" | "NEXT_PUBLIC_BASE_API_MAINNET_URL" | "NEXT_PUBLIC_PROXY_API_URL"
        >
  ) {}

  getBaseApiUrlFor(network: NetworkId, useProxyUrls = false) {
    // Only use proxy URLs for mainnet
    if (useProxyUrls && network === MAINNET_ID) {
      const proxyUrl =
        "PROXY_API_URL" in this.config
          ? this.config.PROXY_API_URL
          : (this.config as Pick<BrowserEnvConfig, "NEXT_PUBLIC_PROXY_API_URL">).NEXT_PUBLIC_PROXY_API_URL;
      return proxyUrl;
    }

    if ("BASE_API_MAINNET_URL" in this.config) {
      switch (network) {
        case TESTNET_ID:
          return this.config.BASE_API_TESTNET_URL;
        case SANDBOX_ID:
          return this.config.BASE_API_SANDBOX_URL;
        default:
          return this.config.BASE_API_MAINNET_URL;
      }
    }

    if ("NEXT_PUBLIC_BASE_API_MAINNET_URL" in this.config) {
      switch (network) {
        case TESTNET_ID:
          return this.config.NEXT_PUBLIC_BASE_API_TESTNET_URL;
        case SANDBOX_ID:
          return this.config.NEXT_PUBLIC_BASE_API_SANDBOX_URL;
        default:
          return this.config.NEXT_PUBLIC_BASE_API_MAINNET_URL;
      }
    }
  }
}
