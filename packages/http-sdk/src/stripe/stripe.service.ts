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

interface CheckoutResponse {
  url: string;
}

interface PaymentResponse {
  error?: {
    message: string;
  };
}

export interface Coupon {
  id: string;
  percent_off?: number | null;
  amount_off?: number | null;
  valid: boolean;
  [key: string]: any;
}

export interface CouponResponse {
  coupon: {
    id: string;
    percent_off?: number | null;
    amount_off?: number | null;
    valid: boolean;
    [key: string]: any;
  };
}

interface CouponListResponse {
  coupons: Array<{
    id: string;
    percent_off?: number | null;
    amount_off?: number | null;
    valid: boolean;
    name?: string;
    description?: string;
    [key: string]: any;
  }>;
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

  async checkout(amount: string, coupon?: string): Promise<CheckoutResponse> {
    const params = new URLSearchParams();
    params.append("amount", amount);
    if (coupon) {
      params.append("coupon", coupon);
    }
    return this.extractData(await this.get(`/v1/checkout?${params.toString()}`));
  }

  async confirmPayment(params: { paymentMethodId: string; amount: number; currency: string; coupon?: string }): Promise<PaymentResponse> {
    return this.extractData(await this.post("/v1/stripe-payment", params));
  }

  async applyCoupon(couponId: string): Promise<CouponResponse> {
    return this.extractData(await this.post("/v1/stripe-coupon", { couponId }));
  }

  async listCoupons(): Promise<CouponListResponse> {
    return this.extractData(await this.get("/v1/stripe-coupons"));
  }
}
