import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

import type { BrowserEnvConfig, ServerEnvConfig } from "@src/config/env-config.schema";

export class ApiUrlService {
  constructor(
    private readonly config:
      | Pick<ServerEnvConfig, "BASE_API_MAINNET_URL" | "BASE_API_TESTNET_URL" | "BASE_API_SANDBOX_URL">
      | Pick<BrowserEnvConfig, "NEXT_PUBLIC_BASE_API_TESTNET_URL" | "NEXT_PUBLIC_BASE_API_SANDBOX_URL" | "NEXT_PUBLIC_BASE_API_MAINNET_URL">
  ) {}

  getBaseApiUrlFor(network: NetworkId) {
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
