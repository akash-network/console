import debounce from "lodash/debounce";

import { ApiHttpService } from "@src/services/api-http/api-http.service";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  creditAmount: number;
}

export class ManagedWalletHttpService extends ApiHttpService {
  constructor() {
    super();

    this.createWallet = debounce(this.createWallet.bind(this), 1000);
  }

  async createWallet(userId: string) {
    return this.addWalletEssentials(this.extractData(await this.post<ApiWalletOutput>("v1/wallets", { data: { userId } })));
  }

  async getWallet(userId: string) {
    const [wallet] = this.extractData(await this.get<ApiWalletOutput[]>("v1/wallets", { params: { userId } }));

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

export const managedWalletHttpService = new ManagedWalletHttpService();
