import { setNetworkVersion } from "./constants";
import { initProtoTypes } from "./proto";

export const initAppTypes = () => {
  setNetworkVersion();
  initProtoTypes();
};
