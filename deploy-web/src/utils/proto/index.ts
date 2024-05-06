import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import { mainnetId, testnetId, sandboxId } from "../constants";
import omit from "lodash/omit";

const commonTypes = { ...omit(v1beta3, "GPU"), ...v1beta4 };
const mainnetTypes = commonTypes;
const sandboxTypes = commonTypes;

export let protoTypes;

export function initProtoTypes() {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId");

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
