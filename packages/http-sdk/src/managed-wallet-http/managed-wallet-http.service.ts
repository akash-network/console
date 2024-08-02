import { ApiHttpService } from "../api-http/api-http.service";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  creditAmount: number;
}

export class ManagedWalletHttpService extends ApiHttpService {
  async createWallet(userId: string) {
    return this.addWalletEssentials(this.extractApiData(await this.post<ApiWalletOutput>("v1/wallets", { data: { userId } })));
  }

  async getWallet(userId: string) {
    const [wallet] = this.extractApiData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: { userId } }));

    return wallet && this.addWalletEssentials(wallet);
  }

  private addWalletEssentials(input: ApiWalletOutput): ApiWalletOutput & { username: "Managed Wallet"; isWalletConnected: true } {
    return {
      ...input,
      username: "Managed Wallet",
      isWalletConnected: true
    };
  }
}
