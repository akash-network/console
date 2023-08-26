import { ApiUrlService } from "./apiUtils";

export enum SelectedRange {
  "7D" = 7,
  "1M" = 30,
  "ALL" = Number.MAX_SAFE_INTEGER
}

// UI
export const statusBarHeight = 30;
export const drawerWidth = 240;
export const closedDrawerWidth = 58;
export const accountBarHeight = 58;

// Deployment creation
export enum RouteStepKeys {
  chooseTemplate = "choose-template",
  editDeployment = "edit-deployment",
  createLeases = "create-leases"
}

const productionMainnetApiUrl = "https://api.cloudmos.io";
const productionTestnetApiUrl = "https://api-testnet.cloudmos.io";

export const isProd = process.env.NODE_ENV === "production";
export const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";
export const BASE_API_MAINNET_URL = getApiMainnetUrl();
export const BASE_API_TESTNET_URL = getApiTestnetUrl();
export const BASE_API_URL = getApiUrl();

export const PROVIDER_PROXY_URL = getProviderProxyHttpUrl();
export const PROVIDER_PROXY_URL_WS = getProviderProxyWsUrl();

export const auth0TokenNamespace = "https://cloudmos.io";

export const uAktDenom = "uakt";
export const usdcIbcDenom = "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84";

// Cloudmos fee
export const feePercent = 3;
// Max .2$
export const maxFee = 0.2;

// Cloudmos validator
export const treasuryAddress = "akash1dh33aa6wc8eh0kt3e43ydcpsv2n3gt7nn9epyn";
export const validatorAddress = "akashvaloper14mt78hz73d9tdwpdvkd59ne9509kxw8yj7qy8f";
export const donationAddress = "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm";

function getApiMainnetUrl() {
  if (process.env.API_MAINNET_BASE_URL) return process.env.API_MAINNET_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (window.location?.hostname === "deploy.cloudmos.io") return productionMainnetApiUrl;
  return "http://localhost:3080";
}

function getApiTestnetUrl() {
  if (process.env.API_TESTNET_BASE_URL) return process.env.API_TESTNET_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (window.location?.hostname === "deploy.cloudmos.io") return productionTestnetApiUrl;
  return "http://localhost:3080";
}

function getApiUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (window.location?.hostname === "deploy.cloudmos.io") {
    try {
      const _selectedNetworkId = localStorage.getItem("selectedNetworkId");
      return _selectedNetworkId === "testnet" ? productionTestnetApiUrl : productionMainnetApiUrl;
    } catch (e) {
      console.error(e);
      return productionMainnetApiUrl;
    }
  }
  return "http://localhost:3080";
}

function getProviderProxyHttpUrl() {
  if (typeof window === "undefined") return "http://localhost:3040";
  if (window.location?.hostname === "deploybeta.cloudmos.io") return "https://deployproxybeta.cloudmos.io";
  if (window.location?.hostname === "deploy.cloudmos.io") return "https://providerproxy.cloudmos.io";
  return "http://localhost:3040";
}

function getProviderProxyWsUrl() {
  if (typeof window === "undefined") return "ws://localhost:3040";
  if (window.location?.hostname === "deploybeta.cloudmos.io") return "wss://deployproxybeta.cloudmos.io";
  if (window.location?.hostname === "deploy.cloudmos.io") return "wss://providerproxy.cloudmos.io";
  return "ws://localhost:3040";
}

// CLOUDMOS DEPLOY
export const mainnetNodes = ApiUrlService.mainnetNodes();
export const testnetNodes = ApiUrlService.testnetNodes();
export const sandboxNodes = ApiUrlService.sandboxNodes();

// export const cloudmosApi = "https://api.cloudmos.io/api";

export const mainnetId = "mainnet";
export const testnetId = "testnet";
export const sandboxId = "sandbox";

export let selectedNetworkId = "";

// 5AKT aka 5000000uakt
export const defaultInitialDeposit = 5000000;

export let networkVersion;

export function setNetworkVersion() {
  const _selectedNetworkId = localStorage.getItem("selectedNetworkId");

  switch (_selectedNetworkId) {
    case mainnetId:
      networkVersion = "v1beta2";
      selectedNetworkId = mainnetId;
      break;
    case testnetId:
      networkVersion = "v1beta3";
      selectedNetworkId = testnetId;
      break;
    case sandboxId:
      networkVersion = "v1beta3";
      selectedNetworkId = sandboxId;
      break;

    default:
      networkVersion = "v1beta2";
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
