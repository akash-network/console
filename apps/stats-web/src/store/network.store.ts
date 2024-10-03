import { NetworkStore } from "@akashnetwork/network-store";

import { browserEnvConfig } from "@/config/browser-env.config";
import { store } from "@/store/global.store";

export const networkStore = NetworkStore.create({
  defaultNetworkId: browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
  apiBaseUrl: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL,
  store
});
