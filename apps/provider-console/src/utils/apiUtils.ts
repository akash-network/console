import { browserEnvConfig } from "@src/config/browser-env.config";
import { appendSearchParams } from "./urlUtils";
export class ApiUrlService {
  static mainnetVersion() {
    return `0.36.0`;
  }
  static testnetVersion() {
    return `0.36.0`;
  }
  static sandboxVersion() {
    return `0.36.0`;
  }

  static mainnetNodes() {
    return `${browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL}/v1/nodes/mainnet`;
  }
  static testnetNodes() {
    return `${browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL}/v1/nodes/testnet`;
  }
  static sandboxNodes() {
    return `${browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL}/v1/nodes/sandbox`;
  }
  static depositParams(apiEndpoint: string) {
    return `${apiEndpoint}/cosmos/params/v1beta1/params?subspace=deployment&key=MinDeposits`;
  }
  static marketData() {
    return `${browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL}/v1/market-data`;
  }
  static blocks(limit: number) {
    return `${browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL}/v1/blocks${appendSearchParams({ limit })}`;
  }
  static block(apiEndpoint: string, id: string) {
    return `${apiEndpoint}/blocks/${id}`;
  }
}
