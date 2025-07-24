import type { ApiManagedWalletOutput, ApiWalletOutput } from "@akashnetwork/http-sdk";
import { ManagedWalletHttpService as ManagedWalletHttpServiceOriginal } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";

export class ManagedWalletHttpService extends ManagedWalletHttpServiceOriginal {
  private checkoutSessionId: string | null = null;

  constructor(
    axios: AxiosInstance,
    private readonly analyticsService: AnalyticsService
  ) {
    super(axios);

    this.extractSessionResults();
  }

  private extractSessionResults() {
    const query = typeof window !== "undefined" && new URLSearchParams(window.location.search);

    if (!query) {
      return;
    }

    if (query.get("payment-canceled") === "true") {
      this.analyticsService.track("payment_cancelled", "Amplitude");
      this.clearSessionResults();
    }

    if (query.get("payment-success") === "true") {
      this.analyticsService.track("payment_success", "Amplitude");
      this.checkoutSessionId = query.get("session_id");
    }
  }

  async getWallet(userId: string): Promise<ApiManagedWalletOutput | null> {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: this.getWalletListParams(userId) }));

    this.clearSessionResults();

    return wallet ? this.addWalletEssentials(wallet) : null;
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
      const newUrl = url.toString();
      // TODO: remove this when fixed https://github.com/vercel/next.js/discussions/18072#discussioncomment-109059
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, document.title, newUrl);
      this.checkoutSessionId = null;
    }
  }
}
