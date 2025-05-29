import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

interface StripePrice {
  unitAmount?: number;
  isCustom: boolean;
  currency: string;
}

interface SetupIntentResponse {
  clientSecret: string;
}

export class StripeService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  async findPrices(config?: AxiosRequestConfig): Promise<StripePrice[]> {
    return this.extractData(await this.get("/v1/stripe-prices", config));
  }

  async createSetupIntent(config?: AxiosRequestConfig): Promise<SetupIntentResponse> {
    return this.extractData(await this.post("/v1/stripe-setup", {}, config));
  }

  async getPaymentMethods() {
    return this.extractData(await this.get("/v1/stripe-payment-methods"));
  }
}
