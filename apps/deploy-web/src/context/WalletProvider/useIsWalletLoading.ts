type SelectedWalletType = "managed" | "custodial";

export type UseIsWalletLoadingInput = {
  hasAuthenticatedUserId: boolean;
  selectedWalletType: SelectedWalletType;
  isManagedWalletLoading: boolean;
  isCustodialConnecting: boolean;
};

export const useIsWalletLoading = (input: UseIsWalletLoadingInput): boolean => {
  return (
    (input.hasAuthenticatedUserId && input.isManagedWalletLoading) ||
    (input.selectedWalletType === "managed" && input.isManagedWalletLoading) ||
    (input.selectedWalletType === "custodial" && input.isCustodialConnecting)
  );
};
