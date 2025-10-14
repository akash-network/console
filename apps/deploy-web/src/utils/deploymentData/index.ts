import type { SupportedChainNetworks } from "@akashnetwork/net";
import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

import networkStore from "@src/store/networkStore";
import * as v1beta3 from "./v1beta3";
export * from "./helpers";

const NETWORK_SDL: Partial<Record<SupportedChainNetworks, typeof v1beta3>> = {
  [MAINNET_ID]: v1beta3,
  [TESTNET_ID]: v1beta3,
  [SANDBOX_ID]: v1beta3
};

export const deploymentData = NETWORK_SDL[networkStore.selectedNetworkId] as typeof v1beta3;
