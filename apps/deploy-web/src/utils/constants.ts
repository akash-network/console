export const mainnetId = "mainnet";
export const testnetId = "testnet";
export const sandboxId = "sandbox";

export const selectedRangeValues: { [key: string]: number } = {
  "7D": 7,
  "1M": 30,
  ALL: Number.MAX_SAFE_INTEGER
};

// UI
export const statusBarHeight = 30;
export const drawerWidth = 240;
export const closedDrawerWidth = 57;
export const accountBarHeight = 57;

// Deployment creation
export enum RouteStepKeys {
  chooseTemplate = "choose-template",
  editDeployment = "edit-deployment",
  createLeases = "create-leases"
}

const productionMainnetApiUrl = "https://api.cloudmos.io";
const productionTestnetApiUrl = "https://api-testnet.cloudmos.io";
const productionSandboxApiUrl = "https://api-sandbox.cloudmos.io";
const productionStatsAppUrl = "https://stats.akash.network";
const productionHostnames = ["deploy.cloudmos.io", "console.akash.network", "staging-console.akash.network", "beta.cloudmos.io"];

export const isProd = process.env.NODE_ENV === "production";
export const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";
export const BASE_API_MAINNET_URL = getApiMainnetUrl();
export const BASE_API_TESTNET_URL = getApiTestnetUrl();
export const BASE_API_SANDBOX_URL = getApiSandboxUrl();
export const STATS_APP_URL = getStatsAppUrl();

export const BASE_API_URL = getApiUrl();

export function getNetworkBaseApiUrl(network: string) {
  switch (network) {
    case testnetId:
      return BASE_API_TESTNET_URL;
    case sandboxId:
      return BASE_API_SANDBOX_URL;
    default:
      return BASE_API_MAINNET_URL;
  }
}

export const PROVIDER_PROXY_URL = getProviderProxyHttpUrl();
export const PROVIDER_PROXY_URL_WS = getProviderProxyWsUrl();

// TODO: Fix for console
export const auth0TokenNamespace = "https://console.akash.network";

export const uAktDenom = "uakt";
export const usdcIbcDenoms = {
  [mainnetId]: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  [sandboxId]: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84"
};
const readableAktDenom = "uAKT";
const readableUsdcDenom = "uUSDC";
export const readableDenoms = {
  [uAktDenom]: readableAktDenom,
  [usdcIbcDenoms[mainnetId]]: readableUsdcDenom,
  [usdcIbcDenoms[sandboxId]]: readableUsdcDenom
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
      return getNetworkBaseApiUrl(_selectedNetworkId || mainnetId);
    } catch (e) {
      console.error(e);
      return productionMainnetApiUrl;
    }
  }
  return "http://localhost:3080";
}

function getStatsAppUrl() {
  if (process.env.STATS_APP_URL) return process.env.STATS_APP_URL;
  if (typeof window === "undefined") return "http://localhost:3001";
  if (productionHostnames.includes(window.location?.hostname)) return productionStatsAppUrl;
  return "http://localhost:3001";
}

function getProviderProxyHttpUrl() {
  if (process.env.PROVIDER_PROXY_URL) return process.env.PROVIDER_PROXY_URL;
  if (typeof window === "undefined") return "http://localhost:3040";
  if (window.location?.hostname === "deploybeta.cloudmos.io") return "https://deployproxybeta.cloudmos.io";
  if (productionHostnames.includes(window.location?.hostname)) return "https://providerproxy.cloudmos.io";
  return "http://localhost:3040";
}

function getProviderProxyWsUrl() {
  if (typeof window === "undefined") return "ws://localhost:3040";
  if (window.location?.hostname === "deploybeta.cloudmos.io") return "wss://deployproxybeta.cloudmos.io";
  if (productionHostnames.includes(window.location?.hostname)) return "wss://providerproxy.cloudmos.io";
  return "ws://localhost:3040";
}

export let selectedNetworkId = "";

// 0.5AKT aka 500000uakt
export const defaultInitialDeposit = 500000;

export let networkVersion: "v1beta2" | "v1beta3" | "v1beta4";
export let networkVersionMarket: "v1beta2" | "v1beta3" | "v1beta4";

export function setNetworkVersion() {
  const _selectedNetworkId = localStorage.getItem("selectedNetworkId");

  switch (_selectedNetworkId) {
    case mainnetId:
      networkVersion = "v1beta3";
      networkVersionMarket = "v1beta4";
      selectedNetworkId = mainnetId;
      break;
    case testnetId:
      networkVersion = "v1beta3";
      networkVersionMarket = "v1beta3";
      selectedNetworkId = testnetId;
      break;
    case sandboxId:
      networkVersion = "v1beta3";
      networkVersionMarket = "v1beta4";
      selectedNetworkId = sandboxId;
      break;

    default:
      networkVersion = "v1beta3";
      networkVersionMarket = "v1beta4";
      selectedNetworkId = mainnetId;
      break;
  }
}

export const monacoOptions = {
  selectOnLineNumbers: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  scrollbar: {
    verticalScrollbarSize: 8
  },
  minimap: {
    enabled: false
  },
  padding: {
    bottom: 50
  },
  hover: {
    enabled: false
  }
};

export const txFeeBuffer = 10000; // 10000 uAKT
