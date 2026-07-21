import type { AxiosRequestConfig } from "axios";

import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
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

export class StripeService {
  readonly #httpClient: HttpClient;
  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async createSetupIntent(config?: AxiosRequestConfig): Promise<SetupIntentResponse> {
    return extractData(await this.#httpClient.post("/v1/stripe/payment-methods/setup", {}, config)).data;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return extractData(await this.#httpClient.get("/v1/stripe/payment-methods")).data;
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    return extractData(await this.#httpClient.delete(`/v1/stripe/payment-methods/${paymentMethodId}`)).data;
  }

  async updateCustomerOrganization(organization: string): Promise<void> {
    await this.#httpClient.put("/v1/stripe/customers/organization", { organization });
  }

  async applyCoupon(couponId: string, userId: string): Promise<CouponResponse> {
    return extractData(await this.#httpClient.post("/v1/stripe/coupons/apply", { data: { couponId, userId } })).data;
  }

  async getCustomerDiscounts(): Promise<CustomerDiscountsResponse> {
    return extractData(await this.#httpClient.get("/v1/stripe/coupons/customer-discounts")).data;
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    return extractData(await this.#httpClient.post("/v1/stripe/transactions/confirm", { data: params })).data;
  }

  async validatePaymentMethodAfter3DS(params: ThreeDSecureAuthParams): Promise<{ success: boolean }> {
    return extractData(await this.#httpClient.post("/v1/stripe/payment-methods/validate", { data: params })).data;
  }

  async setPaymentMethodAsDefault(params: SetPaymentMethodAsDefaultParams): Promise<PaymentMethod[]> {
    return extractData(await this.#httpClient.post("/v1/stripe/payment-methods/default", { data: params })).data;
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

    return extractData(await this.#httpClient.get(url)).data;
  }

  async exportTransactionsCsv(params: ExportTransactionsCsvParams): Promise<Blob> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      timezone: params.timezone
    });

    const url = `/v1/stripe/transactions/export?${queryParams}`;

    return extractData(
      await this.#httpClient.get(url, {
        responseType: "blob"
      })
    );
  }

  async findPrices(config?: AxiosRequestConfig): Promise<StripePrice[]> {
    return extractData(await this.#httpClient.get("/v1/stripe/prices", config)).data;
  }
}
