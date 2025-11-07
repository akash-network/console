import { ApiHttpService } from "../api-http/api-http.service";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
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

export class ManagedWalletHttpService extends ApiHttpService {
  async createWallet(userId: string): Promise<ApiWalletWithOptional3DS & { username: "Managed Wallet"; isWalletConnected: true }> {
    const response = await this.post<ApiWalletWithOptional3DS>("v1/start-trial", { data: { userId } }, { withCredentials: true });

    return this.addWalletEssentials<ApiWalletWithOptional3DS>(this.extractApiData(response));
  }

  async getWallet(userId: string): Promise<ApiManagedWalletOutput | null> {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: { userId } }));

    return wallet ? this.addWalletEssentials<ApiWalletOutput>(wallet) : null;
  }

  async validatePaymentMethodAfter3DS(paymentMethodId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    return this.extractApiData(
      await this.post<{ success: boolean }>(
        "v1/stripe/payment-methods/validate",
        {
          data: { paymentMethodId, paymentIntentId }
        },
        { withCredentials: true }
      )
    );
  }

  protected addWalletEssentials<T extends ApiManagedWalletOutputBase>(input: T): T & { username: "Managed Wallet"; isWalletConnected: true } {
    return {
      ...input,
      username: "Managed Wallet",
      isWalletConnected: true
    };
  }
}

export type ApiManagedWalletOutput = ApiWalletOutput & { username: "Managed Wallet"; isWalletConnected: true };

export type ApiManagedWalletOutputBase = ApiWalletOutput;
