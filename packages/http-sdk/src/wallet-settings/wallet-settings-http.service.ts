import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";
import type { UpdateWalletSettingsParams, WalletSettings } from "./wallet-settings.types";

export type { UpdateWalletSettingsParams, WalletSettings };

export class WalletSettingsHttpService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  async getWalletSettings() {
    return this.extractApiData<WalletSettings>(await this.get("/v1/wallet-settings"));
  }

  async createWalletSettings(settings: WalletSettings) {
    return this.extractApiData<WalletSettings>(await this.post("/v1/wallet-settings", { data: settings }));
  }

  async updateWalletSettings(settings: UpdateWalletSettingsParams) {
    return this.extractApiData<WalletSettings>(await this.put("/v1/wallet-settings", { data: settings }));
  }

  async deleteWalletSettings(): Promise<void> {
    await this.delete("/v1/wallet-settings");
  }
}
