import * as v1beta3 from "./v1beta3";
import { mainnetId, testnetId, sandboxId } from "../constants";
import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { NetworkId } from "@akashnetwork/akashjs/build/types/network";
export * from "./helpers";

const NETWORK_SDL: Record<NetworkId, typeof v1beta3> = {
  [mainnetId]: v1beta3,
  [testnetId]: v1beta3,
  [sandboxId]: v1beta3
};

export let selectedNetwork = getSelectedNetwork();
export let selectedNetworkId = selectedNetwork.id;
export const deploymentData = NETWORK_SDL[selectedNetworkId];
