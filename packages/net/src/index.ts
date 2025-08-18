import { NetConfig, type NetConfigOptions } from "./NetConfig/NetConfig";

export const netConfig = new NetConfig();
export type { SupportedChainNetworks, NetConfigOptions } from "./NetConfig/NetConfig";

export function createNetConfig(options?: NetConfigOptions): NetConfig {
  return new NetConfig(options);
}
