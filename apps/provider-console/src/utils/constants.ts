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

export const isProd = process.env.NODE_ENV === "production";
export const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

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
