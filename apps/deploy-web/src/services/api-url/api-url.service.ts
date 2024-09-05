import type { ServerEnvConfig } from "@src/config/env-config.schema";
import { SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";

export class ApiUrlService {
  constructor(
    private readonly config: Pick<ServerEnvConfig, "NEXT_PUBLIC_BASE_API_TESTNET_URL" | "NEXT_PUBLIC_BASE_API_SANDBOX_URL" | "NEXT_PUBLIC_BASE_API_MAINNET_URL">
  ) {}

  getBaseApiUrlFor(network: string) {
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
