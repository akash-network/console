import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/network-store";

export const selectedRangeValues: { [key: string]: number } = {
  "7D": 7,
  "1M": 30,
  ALL: Number.MAX_SAFE_INTEGER
};

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

export const uAktDenom = "uakt";
export const usdcIbcDenoms: { [key: string]: string } = {
  [MAINNET_ID]: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  [SANDBOX_ID]: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84"
};

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
      const _selectedNetworkId = localStorage.getItem("selectedNetworkId");
      return getNetworkBaseApiUrl(_selectedNetworkId);
    } catch (e) {
      console.error(e);
      return productionMainnetApiUrl;
    }
  }
  return "http://localhost:3080";
}

export let selectedNetworkId = "";
export let networkVersion: "v1beta2" | "v1beta3";

export function setNetworkVersion() {
  const _selectedNetworkId = localStorage.getItem("selectedNetworkId");

  switch (_selectedNetworkId) {
    case MAINNET_ID:
      networkVersion = "v1beta3";
      selectedNetworkId = MAINNET_ID;
      break;
    case TESTNET_ID:
      networkVersion = "v1beta3";
      selectedNetworkId = TESTNET_ID;
      break;
    case SANDBOX_ID:
      networkVersion = "v1beta3";
      selectedNetworkId = SANDBOX_ID;
      break;

    default:
      networkVersion = "v1beta3";
      selectedNetworkId = MAINNET_ID;
      break;
  }
}
