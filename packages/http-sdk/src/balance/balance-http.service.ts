import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { Denom } from "../types/denom.type";

export interface RawBalance {
  amount: string;
  denom: Denom;
}

export interface Balance {
  amount: number;
  denom: Denom;
}

interface BalanceResponse {
  balance: RawBalance;
}

export class BalanceHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getBalance(address: string, denom: string): Promise<Balance | undefined> {
    const response = this.extractData(await this.get<BalanceResponse>(`cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`));
    return response.balance ? { amount: parseFloat(response.balance.amount), denom: response.balance.denom } : undefined;
  }
}
