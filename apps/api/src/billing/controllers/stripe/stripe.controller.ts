import assert from "http-assert";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { StripePricesOutputResponse } from "@src/billing";
import { ConfirmPaymentRequest, Discount, Transaction } from "@src/billing/http-schemas/stripe.schema";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { Semaphore } from "@src/core/lib/semaphore.decorator";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "StripePayment" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<{ data: { clientSecret: string | null } }> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");

    const stripeCustomerId = await this.stripe.getStripeCustomerId(user);

    const setupIntent = await this.stripe.createSetupIntent(stripeCustomerId);
    return { data: { clientSecret: setupIntent.client_secret } };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getPaymentMethods(): Promise<{ data: Stripe.PaymentMethod[] }> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");

    if (!user.stripeCustomerId) {
      return { data: [] };
    }

    const paymentMethods = await this.stripe.getPaymentMethods(user.stripeCustomerId);
    return { data: paymentMethods };
  }

  @Semaphore()
  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirmPayment(params: ConfirmPaymentRequest["data"]): Promise<void> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");
    assert(user.stripeCustomerId, 400, "User does not have a Stripe customer ID");

    // Verify payment method ownership
    const paymentMethod = await this.stripe.paymentMethods.retrieve(params.paymentMethodId);
    const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
    assert(customerId === user.stripeCustomerId, 403, "Payment method does not belong to the user");

    const { success } = await this.stripe.createPaymentIntent({
      customer: user.stripeCustomerId,
      payment_method: params.paymentMethodId,
      amount: params.amount,
      currency: params.currency,
      confirm: true,
      ...(params.coupon ? { coupon: params.coupon } : {})
    });

    assert(success, 402, "Payment not successful");
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async applyCoupon(couponId: string): Promise<{ data: { coupon: Stripe.Coupon | Stripe.PromotionCode | null } }> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");
    assert(user.stripeCustomerId, 400, "User does not have a Stripe customer ID");
    assert(couponId, 400, "Coupon ID is required");

    const coupon = await this.stripe.applyCoupon(user.stripeCustomerId, couponId);
    return { data: { coupon } };
  }

  @Protected([{ action: "delete", subject: "StripePayment" }])
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");
    assert(user.stripeCustomerId, 400, "User does not have a Stripe customer ID");

    // Verify payment method ownership
    const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
    assert(customerId === user.stripeCustomerId, 403, "Payment method does not belong to the user");

    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getCustomerDiscounts(): Promise<{ data: { discounts: Discount[] } }> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");
    assert(user.stripeCustomerId, 400, "User does not have a Stripe customer ID");

    const discounts = await this.stripe.getCustomerDiscounts(user.stripeCustomerId);
    return { data: { discounts } };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getCustomerTransactions(options?: {
    limit?: number;
    startingAfter?: string;
  }): Promise<{ data: { transactions: Transaction[]; hasMore: boolean; nextPage: string | null } }> {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    assert(user, 404, "User not found");
    assert(user.stripeCustomerId, 400, "User does not have a Stripe customer ID");

    const response = await this.stripe.getCustomerTransactions(user.stripeCustomerId, options);
    return { data: response };
  }
}
