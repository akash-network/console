import type { ApiOutput } from "../api-http/api-http.service";
import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  denom: string;
  creditAmount: number;
  isTrialing: boolean;
  trialEndsAt: string | null;
  topUpMinAmountUsd: number;
  createdAt: Date;
}

export class ManagedWalletHttpService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getWallet(input: { [key: string]: string; userId: string }): Promise<ApiManagedWalletOutput | null> {
    const response = await this.#httpClient.get<ApiOutput<ApiWalletOutput[]>>("v1/wallets", { params: input });
    const [wallet] = extractData(response).data;

    return wallet ? this.addWalletEssentials(wallet) : null;
  }

  async validatePaymentMethodAfter3DS(paymentMethodId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    const response = await this.#httpClient.post<ApiOutput<{ success: boolean }>>(
      "v1/stripe/payment-methods/validate",
      {
        data: { paymentMethodId, paymentIntentId }
      },
      { withCredentials: true }
    );
    return extractData(response).data;
  }

  protected addWalletEssentials<T>(input: T): T & { username: "Managed Wallet"; isWalletConnected: true } {
    return {
      ...input,
      username: "Managed Wallet",
      isWalletConnected: true
    };
  }
}

export type ApiManagedWalletOutput = ApiWalletOutput & { username: "Managed Wallet"; isWalletConnected: true };
