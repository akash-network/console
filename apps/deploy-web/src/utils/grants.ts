import { AllowanceType } from "@src/types/grant";

export const getAllowanceTitleByType = (allowance: AllowanceType) => {
  switch (allowance.allowance["@type"]) {
    case "/cosmos.feegrant.v1beta1.BasicAllowance":
      return "Basic";
    case "/cosmos.feegrant.v1beta1.PeriodicAllowance":
      return "Periodic";
    case "$CONNECTED_WALLET":
      return "Connected Wallet";
    default:
      return "Unknown";
  }
};
