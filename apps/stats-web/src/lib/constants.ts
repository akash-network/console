import { SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

import { networkStore } from "@/store/network.store";

const productionMainnetApiUrl = "https://console-api.akash.network";
const productionTestnetApiUrl = "https://console-api-testnet.akash.network";
const productionSandboxApiUrl = "https://console-api-sandbox.akash.network";
const productionHostnames = ["stats.akash.network"];

export const isProd = process.env.NODE_ENV === "production";
export const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";
export const BASE_API_MAINNET_URL = getApiMainnetUrl();
export const BASE_API_TESTNET_URL = getApiTestnetUrl();
export const BASE_API_SANDBOX_URL = getApiSandboxUrl();

export const BASE_API_URL = getApiUrl();

export function getNetworkBaseApiUrl(network: string | null) {
  switch (network) {
    case TESTNET_ID:
      return BASE_API_TESTNET_URL;
    case SANDBOX_ID:
      return BASE_API_SANDBOX_URL;
    default:
      return BASE_API_MAINNET_URL;
  }
}

function getApiMainnetUrl() {
  if (process.env.API_MAINNET_BASE_URL) return process.env.API_MAINNET_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (productionHostnames.includes(window.location?.hostname)) return productionMainnetApiUrl;
  return "http://localhost:3080";
}

function getApiTestnetUrl() {
  if (process.env.API_TESTNET_BASE_URL) return process.env.API_TESTNET_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (productionHostnames.includes(window.location?.hostname)) return productionTestnetApiUrl;
  return "http://localhost:3080";
}

function getApiSandboxUrl() {
  if (process.env.API_SANDBOX_BASE_URL) return process.env.API_SANDBOX_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (productionHostnames.includes(window.location?.hostname)) return productionSandboxApiUrl;
  return "http://localhost:3080";
}

function getApiUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (productionHostnames.includes(window.location?.hostname)) {
    try {
      return getNetworkBaseApiUrl(networkStore.selectedNetworkId);
    } catch (e) {
      console.error(e);
      return productionMainnetApiUrl;
    }
  }
  return "http://localhost:3080";
}
