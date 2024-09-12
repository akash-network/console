import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";
import networkStore from "@src/store/networkStore";

const commonTypes = { ...v1beta3, ...v1beta4 };
const mainnetTypes = commonTypes;
const sandboxTypes = commonTypes;

export let protoTypes;

export function initProtoTypes() {
  const selectedNetworkId: NetworkId = networkStore.getSelectedNetworkId();

  switch (selectedNetworkId) {
    case MAINNET_ID:
    case TESTNET_ID:
      protoTypes = mainnetTypes;
      break;

    case SANDBOX_ID:
      protoTypes = sandboxTypes;
      break;

    default:
      protoTypes = mainnetTypes;
      break;
  }
}
