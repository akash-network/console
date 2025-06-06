import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";
import type { Charge, CouponResponse, CustomerDiscountsResponse, PaymentResponse, SetupIntentResponse, StripePrice } from "./stripe.types";

export class StripeService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  // Payment Methods
  async createSetupIntent(config?: AxiosRequestConfig): Promise<SetupIntentResponse> {
    return this.extractData(await this.post("/v1/payment-methods/setup", {}, config));
  }

  async getPaymentMethods() {
    return this.extractData(await this.get("/v1/payment-methods"));
  }

  async removePaymentMethod(paymentMethodId: string) {
    return this.extractData(await this.delete(`/v1/payment-methods/${paymentMethodId}`));
  }

  // Coupons
  async applyCoupon(couponId: string): Promise<CouponResponse> {
    return this.extractData(await this.post("/v1/coupons/apply", { couponId }));
  }

  async getCustomerDiscounts(): Promise<CustomerDiscountsResponse> {
    return this.extractData(await this.get("/v1/coupons/customer-discounts"));
  }

  // Transactions
  async confirmPayment(params: { paymentMethodId: string; amount: number; currency: string; coupon?: string }): Promise<PaymentResponse> {
    return this.extractData(await this.post("/v1/transactions/confirm", params));
  }

  async getCustomerTransactions(options?: { limit?: number; startingAfter?: string }): Promise<{ transactions: Charge[] }> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options?.startingAfter) {
      params.append("startingAfter", options.startingAfter);
    }
    return this.extractData(await this.get(`/v1/transactions?${params.toString()}`));
  }

  // Prices (legacy endpoint)
  async findPrices(config?: AxiosRequestConfig): Promise<StripePrice[]> {
    return this.extractData(await this.get("/v1/stripe-prices", config));
  }
}
