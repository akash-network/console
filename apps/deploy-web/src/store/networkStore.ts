import { NetworkStore } from "@akashnetwork/network-store";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { store } from "@src/store/global-store";

export default NetworkStore.create({
  defaultNetworkId: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  fixed: true,
  apiBaseUrl: "/api",
  store
});
