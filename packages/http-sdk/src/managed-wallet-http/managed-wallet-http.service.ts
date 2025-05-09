import { ApiHttpService } from "../api-http/api-http.service";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  creditAmount: number;
  isTrialing: boolean;
}

export class ManagedWalletHttpService extends ApiHttpService {
  async createWallet(userId: string) {
    return this.addWalletEssentials(this.extractApiData(await this.post<ApiWalletOutput>("v1/start-trial", { data: { userId } }, { withCredentials: true })));
  }

  async getWallet(userId: string): Promise<ApiManagedWalletOutput | null> {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: { userId } }));

    return wallet ? this.addWalletEssentials(wallet) : null;
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
