import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { StripePricesOutputResponse } from "@src/billing";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "StripePrice" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "PaymentMethod" }])
  async createSetupIntent() {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    if (!user) {
      throw new Error("User not found");
    }

    let stripeCustomerId = user.stripeCustomerId;

    // TODO: make the checkout work
    // there should only be one place we create a customer
    // webhook secret
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: user.userId
        }
      });

      await this.userRepository.updateById(user.id, {
        stripeCustomerId: customer.id
      });

      stripeCustomerId = customer.id;
    }

    const setupIntent = await this.stripe.createSetupIntent(stripeCustomerId);
    return { clientSecret: setupIntent.client_secret };
  }

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getPaymentMethods() {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeCustomerId) {
      return { data: [] };
    }

    const paymentMethods = await this.stripe.getPaymentMethods(user.stripeCustomerId);
    return { data: paymentMethods };
  }

  @Protected([{ action: "create", subject: "PaymentIntent" }])
  async confirmPayment(params: { paymentMethodId: string; amount: number; currency: string; coupon?: string }) {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }
    try {
      const { success } = await this.stripe.createPaymentIntent({
        customer: user.stripeCustomerId,
        payment_method: params.paymentMethodId,
        amount: params.amount,
        currency: params.currency,
        confirm: true,
        ...(params.coupon ? { coupon: params.coupon } : {})
      });
      if (!success) {
        return { error: { message: "Payment not successful" } };
      }
      return {};
    } catch (error: any) {
      return { error: { message: error.message || "Payment failed" } };
    }
  }

  @Protected([{ action: "create", subject: "Coupon" }])
  async applyCoupon(couponId: string) {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }
    try {
      const coupon = await this.stripe.applyCoupon(user.stripeCustomerId, couponId);
      return { coupon };
    } catch (error: any) {
      throw new Error(error.message || "Failed to apply coupon");
    }
  }

  @Protected([{ action: "read", subject: "Coupon" }])
  async getCoupon(couponId: string) {
    try {
      const coupon = await this.stripe.getCoupon(couponId);
      if (!coupon) {
        throw new Error("Coupon not found");
      }
      return { coupon };
    } catch (error: any) {
      if (error.message === "Coupon not found") {
        throw error;
      }
      throw new Error("Failed to get coupon");
    }
  }

  @Protected([{ action: "delete", subject: "PaymentMethod" }])
  async removePaymentMethod(paymentMethodId: string) {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }

    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  @Protected([{ action: "read", subject: "Coupon" }])
  async getCustomerDiscounts() {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }

    const response = await this.stripe.getCustomerDiscounts(user.stripeCustomerId);
    const formattedDiscounts = response.discounts.map(discount => ({
      type: discount.type as "coupon" | "promotion_code",
      id: discount.id,
      name: discount.name,
      code: discount.code,
      percent_off: discount.percent_off,
      amount_off: discount.amount_off,
      currency: discount.currency,
      valid: discount.valid
    }));

    return { discounts: formattedDiscounts };
  }

  @Protected([{ action: "read", subject: "Transaction" }])
  async getCustomerTransactions(options?: { limit?: number; startingAfter?: string }) {
    const userId = this.authService.currentUser.userId;
    const user = await this.userRepository.findOneBy({ userId });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }

    return await this.stripe.getCustomerTransactions(user.stripeCustomerId, options);
  }
}
