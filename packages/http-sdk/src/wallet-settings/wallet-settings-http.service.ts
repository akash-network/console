import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";
import type {
  UpdateWalletSettingsParams,
  WalletSettings,
} from "./wallet-settings.types";

export class WalletSettingsHttpService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  async getWalletSettings(): Promise<WalletSettings> {
    return this.extractApiData(await this.get("/v1/wallet-settings"));
  }

  async createWalletSettings(settings: WalletSettings): Promise<WalletSettings> {
    return this.extractApiData(await this.post("/v1/wallet-settings", { data: settings }));
  }

  async updateWalletSettings(settings: UpdateWalletSettingsParams): Promise<WalletSettings> {
    return this.extractApiData(await this.put("/v1/wallet-settings", { data: settings }));
  }

  async deleteWalletSettings(): Promise<void> {
    await this.delete("/v1/wallet-settings");
  }
}
