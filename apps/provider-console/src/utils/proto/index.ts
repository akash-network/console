import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { mainnetId, sandboxId, testnetId } from "../constants";

const commonTypes = { ...v1beta3, ...v1beta4 };
const mainnetTypes = commonTypes;
const sandboxTypes = commonTypes;

export let protoTypes;

export function initProtoTypes() {
  const selectedNetworkId = browserEnvConfig.NEXT_PUBLIC_CHAIN_ID ?? mainnetId;

  switch (selectedNetworkId) {
    case mainnetId:
    case testnetId:
      protoTypes = mainnetTypes;
      break;

    case sandboxId:
      protoTypes = sandboxTypes;
      break;

    default:
      protoTypes = mainnetTypes;
      break;
  }
}
