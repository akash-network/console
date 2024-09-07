import { networkService } from "@src/services/network/network.service";
import { initProtoTypes } from "./proto";
import { setMessageTypes } from "./TransactionMessageData";

export const initAppTypes = () => {
  networkService.setNetworkVersion();
  initProtoTypes();
  setMessageTypes();
};
