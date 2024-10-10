import { initProtoTypes } from "./proto";
import { setMessageTypes } from "./TransactionMessageData";

export const initAppTypes = () => {
  initProtoTypes();
  setMessageTypes();
};
