import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";

type API_VERSION = "v1beta2" | "v1beta3" | "v1beta4";

export class NetworkService {
  selectedNetworkId: NetworkId;

  get networkVersion(): API_VERSION {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");

    switch (selectedNetworkId) {
      case MAINNET_ID:
      case TESTNET_ID:
      case SANDBOX_ID:
      default:
        return "v1beta3";
    }
  }
  
  get networkVersionMarket(): API_VERSION {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");
    switch (selectedNetworkId) {
      case TESTNET_ID:
        return "v1beta3";
      case MAINNET_ID:
      case SANDBOX_ID:
      default:
        return "v1beta4";
    }
  }
}

export const networkService = new NetworkService();
