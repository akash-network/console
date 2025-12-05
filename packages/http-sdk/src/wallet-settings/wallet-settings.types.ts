export interface WalletSettings {
  autoReloadEnabled: boolean;
}

export interface WalletSettingsResponse {
  data: WalletSettings;
}

export interface UpdateWalletSettingsParams {
  autoReloadEnabled?: boolean;
}
