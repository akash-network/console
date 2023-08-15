import * as v1beta2 from "./v1beta2";
import * as v1beta3 from "./v1beta3";
import { mainnetId, testnetId, sandboxId } from "../constants";
export * from "./helpers";

export let deploymentData;
export let selectedNetworkId;

export function initDeploymentData() {
  selectedNetworkId = localStorage.getItem("selectedNetworkId");

  switch (selectedNetworkId) {
    case mainnetId:
      deploymentData = v1beta2;
      break;
    case testnetId:
      deploymentData = v1beta3;
      break;
    case sandboxId:
      deploymentData = v1beta2;
      break;

    default:
      deploymentData = v1beta2;
      break;
  }
}
