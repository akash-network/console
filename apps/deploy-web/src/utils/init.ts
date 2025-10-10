import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";

// import { initProtoTypes } from "./proto";
// import { setMessageTypes } from "./TransactionMessageData";

// export const initAkashTypes = (config: AppConfig) => {
//   initProtoTypes({ networkId: config.networkId });
//   setMessageTypes(config);
// };

export interface AppConfig {
  deploymentVersion: string;
  marketVersion: string;
  escrowVersion: string;
  certVersion: string;
  providerVersion: string;
  networkId: NetworkId;
}
