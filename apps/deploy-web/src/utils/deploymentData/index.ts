import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import networkStore from "@src/store/networkStore";
import { mainnetId, sandboxId, testnetId } from "../constants";
import * as v1beta3 from "./v1beta3";
export * from "./helpers";

const NETWORK_SDL: Record<NetworkId, typeof v1beta3> = {
  [mainnetId]: v1beta3,
  [testnetId]: v1beta3,
  [sandboxId]: v1beta3
};

export const selectedNetwork = networkStore.getSelectedNetwork();
export const selectedNetworkId = selectedNetwork.id;
export const deploymentData = NETWORK_SDL[selectedNetworkId];
