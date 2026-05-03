import type { SelectedWalletType } from "@src/store/walletStore";

export type UseIsWalletLoadingInput = {
  hasAuthenticatedUserId: boolean;
  selectedWalletType: SelectedWalletType;
  isManagedWalletLoading: boolean;
  isCustodialConnecting: boolean;
};

export const useIsWalletLoading = (input: UseIsWalletLoadingInput): boolean => {
  const isManagedQueryRelevant = input.hasAuthenticatedUserId || input.selectedWalletType === "managed";
  return (isManagedQueryRelevant && input.isManagedWalletLoading) || (input.selectedWalletType === "custodial" && input.isCustodialConnecting);
};
