import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { Denom } from "../types/denom.type";

interface Balance {
  amount: string;
  denom: Denom;
}

interface BalanceResponse {
  balance: Balance;
}

export class BalanceHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getBalance(address: string, denom: string) {
    const response = this.extractData(await this.get<BalanceResponse>(`cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`));
    return response.balance;
  }
}
