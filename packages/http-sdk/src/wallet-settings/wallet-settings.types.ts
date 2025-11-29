export interface WalletSettings {
  autoReloadEnabled: boolean;
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}

export interface WalletSettingsResponse {
  data: WalletSettings;
}

export interface UpdateWalletSettingsParams {
  autoReloadEnabled?: boolean;
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}
