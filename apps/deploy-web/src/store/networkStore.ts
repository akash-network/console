import { NetworkStore } from "@akashnetwork/network-store";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { store } from "@src/store/global-store";

export default NetworkStore.create({
  defaultNetworkId: browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
  apiBaseUrl: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL,
  store
});
