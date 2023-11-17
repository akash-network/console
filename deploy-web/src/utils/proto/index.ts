import * as v1beta3 from "./v1beta3";
import * as v1beta4 from "./v1beta4";
import { mainnetId, testnetId, sandboxId } from "../constants";

const mainnetTypes = v1beta3; // TODO Change after v0.28.1 upgrade
const sandboxTypes = { ...v1beta3, ...v1beta4 };

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
