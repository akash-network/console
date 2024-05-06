import { setNetworkVersion } from "./constants";
import { initProtoTypes } from "./proto";
import { setMessageTypes } from "./TransactionMessageData";

export const initAppTypes = () => {
  setNetworkVersion();
  initProtoTypes();
  setMessageTypes();
};
