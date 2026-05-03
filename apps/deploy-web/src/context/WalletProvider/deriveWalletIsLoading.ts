type SelectedWalletType = "managed" | "custodial";

export type DeriveWalletIsLoadingInput = {
  hasAuthenticatedUserId: boolean;
  selectedWalletType: SelectedWalletType;
  isManagedWalletLoading: boolean;
  isCustodialConnecting: boolean;
};

export const deriveWalletIsLoading = (input: DeriveWalletIsLoadingInput): boolean => {
  return (
    (input.hasAuthenticatedUserId && input.isManagedWalletLoading) ||
    (input.selectedWalletType === "managed" && input.isManagedWalletLoading) ||
    (input.selectedWalletType === "custodial" && input.isCustodialConnecting)
  );
};
