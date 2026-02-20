import { type NetworkId, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/chain-sdk/web";

import type { BrowserEnvConfig } from "@/config/env-config.schema";

export class ApiUrlService {
  constructor(
    private readonly config: Pick<BrowserEnvConfig, "VITE_BASE_API_TESTNET_URL" | "VITE_BASE_API_SANDBOX_URL" | "VITE_BASE_API_MAINNET_URL">
  ) {}

  getBaseApiUrlFor(network: NetworkId) {
    switch (network) {
      case TESTNET_ID:
        return this.config.VITE_BASE_API_TESTNET_URL;
      case SANDBOX_ID:
        return this.config.VITE_BASE_API_SANDBOX_URL;
      default:
        return this.config.VITE_BASE_API_MAINNET_URL;
    }
  }
}
