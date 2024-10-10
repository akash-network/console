import { ApiWalletOutput, ManagedWalletHttpService as ManagedWalletHttpServiceOriginal } from "@akashnetwork/http-sdk";
import { AxiosRequestConfig } from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { browserApiUrlService } from "@src/services/api-url/browser-api-url.service";
import { authService } from "@src/services/auth/auth.service";

class ManagedWalletHttpService extends ManagedWalletHttpServiceOriginal {
  private checkoutSessionId: string | null = null;

  constructor(config?: AxiosRequestConfig) {
    super(config);

    this.extractSessionResults();
  }

  private extractSessionResults() {
    const query = typeof window !== "undefined" && new URLSearchParams(window.location.search);

    if (!query) {
      return;
    }

    if (query.get("payment-canceled") === "true") {
      this.clearSessionResults();
    }

    if (query.get("payment-success") === "true") {
      this.checkoutSessionId = query.get("session_id");
    }
  }

  async getWallet(userId: string) {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: this.getWalletListParams(userId) }));

    this.clearSessionResults();

    return wallet && this.addWalletEssentials(wallet);
  }

  private getWalletListParams(userId: string) {
    const params: { userId: string; awaitSessionId?: string } = { userId };

    if (this.checkoutSessionId) {
      params.awaitSessionId = this.checkoutSessionId;
    }
    return params;
  }

  private clearSessionResults() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("payment-canceled");
      url.searchParams.delete("payment-success");
      window.history.replaceState({}, document.title, url.toString());
      this.checkoutSessionId = null;
    }
  }
}

export const managedWalletHttpService = new ManagedWalletHttpService({
  baseURL: browserApiUrlService.getBaseApiUrlFor(browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)
});
managedWalletHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
