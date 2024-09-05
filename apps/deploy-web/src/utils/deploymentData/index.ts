import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";
import networkStore from "@src/store/networkStore";
import * as v1beta3 from "./v1beta3";
export * from "./helpers";

const NETWORK_SDL: Record<NetworkId, typeof v1beta3> = {
  [MAINNET_ID]: v1beta3,
  [TESTNET_ID]: v1beta3,
  [SANDBOX_ID]: v1beta3
};

export const selectedNetwork = networkStore.getSelectedNetwork();
export const selectedNetworkId = selectedNetwork.id;
export const deploymentData = NETWORK_SDL[selectedNetworkId];
