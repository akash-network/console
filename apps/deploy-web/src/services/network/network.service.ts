import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";

type API_VERSION = "v1beta2" | "v1beta3" | "v1beta4";

export class NetworkService {
  selectedNetworkId: NetworkId;

  networkVersion: API_VERSION;

  networkVersionMarket: API_VERSION;

  setNetworkVersion() {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");

    switch (selectedNetworkId) {
      case MAINNET_ID:
        this.networkVersion = "v1beta3";
        this.networkVersionMarket = "v1beta4";
        this.selectedNetworkId = MAINNET_ID;
        break;
      case TESTNET_ID:
        this.networkVersion = "v1beta3";
        this.networkVersionMarket = "v1beta3";
        this.selectedNetworkId = TESTNET_ID;
        break;
      case SANDBOX_ID:
        this.networkVersion = "v1beta3";
        this.networkVersionMarket = "v1beta4";
        this.selectedNetworkId = SANDBOX_ID;
        break;

      default:
        this.networkVersion = "v1beta3";
        this.networkVersionMarket = "v1beta4";
        this.selectedNetworkId = MAINNET_ID;
        break;
    }
  }
}

export const networkService = new NetworkService();
