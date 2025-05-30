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
    console.log("DEBUG: createSetupIntent", userId, user);
    if (!user) {
      throw new Error("User not found");
    }

    let stripeCustomerId = user.stripeCustomerId;

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
      const paymentIntent = await this.stripe.createPaymentIntent({
        customer: user.stripeCustomerId,
        payment_method: params.paymentMethodId,
        amount: Math.round(params.amount * 100), // Stripe expects amount in cents
        currency: params.currency,
        confirm: true,
        ...(params.coupon ? { coupon: params.coupon } : {})
      });
      if (paymentIntent.status !== "succeeded") {
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

  @Protected()
  async listCoupons() {
    try {
      const coupons = await this.stripe.listCoupons();
      return coupons;
    } catch (error) {
      throw new Error("Failed to list coupons");
    }
  }

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
}
