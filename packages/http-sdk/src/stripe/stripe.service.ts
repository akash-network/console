import { AxiosRequestConfig } from "axios";

import { ApiOutput } from "../api-http/api-http.service";
import { HttpService } from "../http/http.service";

interface StripePrice {
  unitAmount?: number;
  isCustom: boolean;
  currency: string;
}

export class StripeService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async findPrices() {
    return this.extractData(await this.get<ApiOutput<StripePrice[]>>("/v1/stripe-prices"));
  }
}
