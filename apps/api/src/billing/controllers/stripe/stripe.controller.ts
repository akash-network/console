import assert from "http-assert";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { StripePricesOutputResponse } from "@src/billing";
import { ConfirmPaymentRequest, Discount, Transaction } from "@src/billing/http-schemas/stripe.schema";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe/stripe-error/stripe-error.service";
import { Semaphore } from "@src/core/lib/semaphore.decorator";

@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly authService: AuthService,
    private readonly stripeErrorService: StripeErrorService
  ) {}

  @Protected([{ action: "read", subject: "StripePayment" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<{ data: { clientSecret: string | null } }> {
    const { currentUser } = this.authService;

    const stripeCustomerId = await this.stripe.getStripeCustomerId(currentUser);

    const setupIntent = await this.stripe.createSetupIntent(stripeCustomerId);
    return { data: { clientSecret: setupIntent.client_secret } };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getPaymentMethods(): Promise<{ data: Stripe.PaymentMethod[] }> {
    const { currentUser } = this.authService;

    if (!currentUser.stripeCustomerId) {
      return { data: [] };
    }

    const paymentMethods = await this.stripe.getPaymentMethods(currentUser.stripeCustomerId);
    return { data: paymentMethods };
  }

  @Semaphore()
  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirmPayment(params: ConfirmPaymentRequest["data"]): Promise<void> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    try {
      // Verify payment method ownership
      const paymentMethod = await this.stripe.paymentMethods.retrieve(params.paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      assert(customerId === currentUser.stripeCustomerId, 403, "Payment method does not belong to the user");

      const { success } = await this.stripe.createPaymentIntent({
        customer: currentUser.stripeCustomerId,
        payment_method: params.paymentMethodId,
        amount: params.amount,
        currency: params.currency,
        confirm: true
      });

      assert(success, 402, "Payment not successful");
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async applyCoupon(
    couponId: string
  ): Promise<{ data: { coupon: Stripe.Coupon | Stripe.PromotionCode | null; fundedAmount?: number; error?: { message: string } } }> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");
    assert(couponId, 400, "Coupon ID is required");

    try {
      const result = await this.stripe.applyCoupon(currentUser.stripeCustomerId, couponId);
      return { data: { coupon: result.coupon, fundedAmount: result.fundedAmount } };
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "coupon")) {
        return { data: this.stripeErrorService.toCouponResponseError(error) };
      }

      throw error;
    }
  }

  @Protected([{ action: "delete", subject: "StripePayment" }])
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    try {
      // Verify payment method ownership
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      assert(customerId === currentUser.stripeCustomerId, 403, "Payment method does not belong to the user");

      await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getCustomerDiscounts(): Promise<{ data: { discounts: Discount[] } }> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    const discounts = await this.stripe.getCustomerDiscounts(currentUser.stripeCustomerId);
    return { data: { discounts } };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getCustomerTransactions(options?: {
    limit?: number;
    startingAfter?: string;
  }): Promise<{ data: { transactions: Transaction[]; hasMore: boolean; nextPage: string | null } }> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    const response = await this.stripe.getCustomerTransactions(currentUser.stripeCustomerId, options);
    return { data: response };
  }
}
