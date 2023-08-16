import { setNetworkVersion } from "./constants";
import { registerTypes } from "./customRegistry";
import { initDeploymentData } from "./deploymentData";
import { initProtoTypes } from "./proto";
import { setMessageTypes } from "./TransactionMessageData";

export const initAppTypes = () => {
  setNetworkVersion();
  initProtoTypes();
  setMessageTypes();
  registerTypes();
  initDeploymentData();
};
