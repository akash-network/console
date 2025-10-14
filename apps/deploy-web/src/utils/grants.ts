import { BasicAllowance, PeriodicAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

import type { AllowanceType } from "@src/types/grant";

export const getAllowanceTitleByType = (allowance: AllowanceType) => {
  switch (allowance.allowance["@type"]) {
    case `/${BasicAllowance.$type}`:
      return "Basic";
    case `/${PeriodicAllowance.$type}`:
      return "Periodic";
    case "$CONNECTED_WALLET":
      return "Connected Wallet";
    default:
      return "Unknown";
  }
};
