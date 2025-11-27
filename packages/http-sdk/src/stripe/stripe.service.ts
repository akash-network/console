import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";
import type {
  ConfirmPaymentParams,
  ConfirmPaymentResponse,
  CouponResponse,
  CustomerDiscountsResponse,
  CustomerTransactionsParams,
  CustomerTransactionsResponse,
  ExportTransactionsCsvParams,
  PaymentMethod,
  SetPaymentMethodAsDefaultParams,
  SetupIntentResponse,
  StripePrice,
  ThreeDSecureAuthParams
} from "./stripe.types";

export class StripeService extends ApiHttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  async createSetupIntent(config?: AxiosRequestConfig): Promise<SetupIntentResponse> {
    return this.extractApiData(await this.post("/v1/stripe/payment-methods/setup", {}, config));
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.extractApiData(await this.get("/v1/stripe/payment-methods"));
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    return this.extractApiData(await this.delete(`/v1/stripe/payment-methods/${paymentMethodId}`));
  }

  async updateCustomerOrganization(organization: string): Promise<void> {
    await this.put("/v1/stripe/customers/organization", { organization });
  }

  async applyCoupon(couponId: string, userId: string): Promise<CouponResponse> {
    return this.extractApiData(await this.post("/v1/stripe/coupons/apply", { data: { couponId, userId } }));
  }

  async getCustomerDiscounts(): Promise<CustomerDiscountsResponse> {
    return this.extractApiData(await this.get("/v1/stripe/coupons/customer-discounts"));
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    return this.extractApiData(await this.post("/v1/stripe/transactions/confirm", { data: params }));
  }

  async validatePaymentMethodAfter3DS(params: ThreeDSecureAuthParams): Promise<{ success: boolean }> {
    return this.extractApiData(await this.post("/v1/stripe/payment-methods/validate", { data: params }));
  }

  async setPaymentMethodAsDefault(params: SetPaymentMethodAsDefaultParams): Promise<PaymentMethod[]> {
    return this.extractApiData(await this.post("/v1/stripe/payment-methods/default", { data: params }));
  }

  async getCustomerTransactions(options?: CustomerTransactionsParams): Promise<CustomerTransactionsResponse> {
    const { limit, startingAfter, endingBefore, startDate, endDate } = options || {};

    if (startDate && endDate && startDate >= endDate) {
      throw new Error("startDate must be less than endDate");
    }

    const params = new URLSearchParams({
      ...(limit && { limit: limit.toString() }),
      ...(startingAfter && { startingAfter }),
      ...(endingBefore && { endingBefore }),
      ...(startDate && { startDate: startDate.toISOString() }),
      ...(endDate && { endDate: endDate.toISOString() })
    });

    const url = `/v1/stripe/transactions${params.toString() ? `?${params}` : ""}`;

    return this.extractApiData(await this.get(url));
  }

  async exportTransactionsCsv(params: ExportTransactionsCsvParams): Promise<Blob> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      timezone: params.timezone
    });

    const url = `/v1/stripe/transactions/export?${queryParams}`;

    return this.extractData(
      await this.get(url, {
        responseType: "blob"
      })
    );
  }

  async findPrices(config?: AxiosRequestConfig): Promise<StripePrice[]> {
    return this.extractApiData(await this.get("/v1/stripe/prices", config));
  }
}
