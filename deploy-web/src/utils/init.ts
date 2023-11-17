import { setNetworkVersion } from "./constants";
import { initDeploymentData } from "./deploymentData";
import { initProtoTypes } from "./proto";
import { setMessageTypes } from "./TransactionMessageData";

export const initAppTypes = () => {
  setNetworkVersion();
  initProtoTypes();
  setMessageTypes();
  initDeploymentData();
};
