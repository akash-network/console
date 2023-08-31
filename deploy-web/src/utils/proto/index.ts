import * as v1beta2 from "./v1beta2";
import * as v1beta3 from "./v1beta3";
import { mainnetId, testnetId, sandboxId } from "../constants";

export let protoTypes;

export function initProtoTypes() {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId");

  switch (selectedNetworkId) {
    case mainnetId:
      protoTypes = v1beta3;
      break;
    case testnetId:
      protoTypes = v1beta3;
      break;
    case sandboxId:
      protoTypes = v1beta3;
      break;

    default:
      protoTypes = v1beta3;
      break;
  }
}
