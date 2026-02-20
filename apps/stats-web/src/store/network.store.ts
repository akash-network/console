import { NetworkStore } from "@akashnetwork/network-store";

import { browserEnvConfig } from "@/config/browser-env.config";
import { store } from "@/store/global.store";

export const networkStore = NetworkStore.create({
  defaultNetworkId: browserEnvConfig.VITE_DEFAULT_NETWORK_ID,
  apiBaseUrl: browserEnvConfig.VITE_API_BASE_URL,
  store
});
