import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

import networkStore from "@src/store/networkStore";

const commonTypes = { ...v1beta3, ...v1beta4 };
const mainnetTypes = commonTypes;
const sandboxTypes = commonTypes;

export let protoTypes: typeof commonTypes | typeof mainnetTypes | typeof sandboxTypes;

export function initProtoTypes() {
  switch (networkStore.selectedNetworkId) {
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
