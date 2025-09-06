import { ApiHttpService } from "../api-http/api-http.service";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  creditAmount: number;
  isTrialing: boolean;
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

export class ManagedWalletHttpService extends ApiHttpService {
  async createWallet(userId: string): Promise<ApiWalletWithOptional3DS> {
    const response = await this.post<ApiWalletWithOptional3DS>("v1/start-trial", { data: { userId } }, { withCredentials: true });

    return this.addWalletEssentials(this.extractApiData(response));
  }

  async getWallet(userId: string): Promise<ApiManagedWalletOutput | null> {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: { userId } }));

    return wallet ? this.addWalletEssentials(wallet) : null;
  }

  async markPaymentMethodValidatedAfter3DS(paymentMethodId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    return this.extractApiData(
      await this.post<{ success: boolean }>(
        "v1/stripe/payment-methods/mark-validated",
        {
          data: { paymentMethodId, paymentIntentId }
        },
        { withCredentials: true }
      )
    );
  }

  protected addWalletEssentials(input: ApiWalletOutput): ApiManagedWalletOutput {
    return {
      ...input,
      username: "Managed Wallet",
      isWalletConnected: true
    };
  }
}

export type ApiManagedWalletOutput = ApiWalletOutput & { username: "Managed Wallet"; isWalletConnected: true };
