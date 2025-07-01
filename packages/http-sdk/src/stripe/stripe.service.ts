import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";
import type { Charge, ConfirmPaymentParams, CouponResponse, CustomerDiscountsResponse, PaymentMethod, SetupIntentResponse, StripePrice } from "./stripe.types";

export class StripeService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  // Payment Methods
  async createSetupIntent(config?: AxiosRequestConfig): Promise<SetupIntentResponse> {
    return this.extractApiData(await this.post("/v1/stripe/payment-methods/setup", {}, config));
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.extractApiData(await this.get("/v1/stripe/payment-methods"));
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    return this.extractApiData(await this.delete(`/v1/stripe/payment-methods/${paymentMethodId}`));
  }

  // Coupons
  async applyCoupon(couponId: string): Promise<CouponResponse> {
    return this.extractApiData(await this.post("/v1/stripe/coupons/apply", { data: { couponId } }));
  }

  async getCustomerDiscounts(): Promise<CustomerDiscountsResponse> {
    return this.extractApiData(await this.get("/v1/stripe/coupons/customer-discounts"));
  }

  // Transactions
  async confirmPayment(params: ConfirmPaymentParams): Promise<void> {
    return this.extractApiData(await this.post("/v1/stripe/transactions/confirm", { data: params }));
  }

  async getCustomerTransactions(options?: {
    limit?: number;
    startingAfter?: string | null;
    endingBefore?: string | null;
    created?: { gt?: number; lt?: number };
  }): Promise<{ transactions: Charge[]; hasMore: boolean; nextPage: string | null; prevPage: string | null; totalCount: number }> {
    const { limit, startingAfter, endingBefore, created } = options || {};
    const params = new URLSearchParams({
      ...(limit && { limit: limit.toString() }),
      ...(startingAfter && { startingAfter }),
      ...(endingBefore && { endingBefore }),
      ...(created?.gt && { "created[gt]": created.gt.toString() }),
      ...(created?.lt && { "created[lt]": created.lt.toString() })
    });
    const url = `/v1/stripe/transactions${params.toString() ? `?${params}` : ""}`;
    return this.extractApiData(await this.get(url));
  }

  // Prices (legacy endpoint)
  async findPrices(config?: AxiosRequestConfig): Promise<StripePrice[]> {
    return this.extractApiData(await this.get("/v1/stripe/prices", config));
  }
}
