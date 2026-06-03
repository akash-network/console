export type DeriveWalletIsLoadingInput = {
  hasAuthenticatedUserId: boolean;
  isManagedWalletLoading: boolean;
};

export const deriveWalletIsLoading = (input: DeriveWalletIsLoadingInput): boolean => {
  return input.hasAuthenticatedUserId && input.isManagedWalletLoading;
};
