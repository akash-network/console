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
  createdAt: Date;
}

export interface ApiThreeDSecureAuth {
  requires3DS: boolean;
  clientSecret: string;
  paymentIntentId: string;
  paymentMethodId: string;
}

export interface ApiWalletWithOptional3DS extends ApiWalletOutput {
  requires3DS?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
}

export class ManagedWalletHttpService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }
  async createWallet(userId: string): Promise<ApiWalletWithOptional3DS & { username: "Managed Wallet"; isWalletConnected: true }> {
    const response = await this.#httpClient.post<ApiOutput<ApiWalletWithOptional3DS>>("v1/start-trial", { data: { userId } }, { withCredentials: true });

    return this.addWalletEssentials(extractData(response).data);
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

export type ApiManagedWalletOutputBase = ApiWalletOutput;
