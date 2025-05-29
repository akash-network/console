import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { StripePricesOutputResponse } from "@src/billing";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository
  ) {}

  @Protected([{ action: "read", subject: "StripePrice" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "PaymentMethod" }])
  async createSetupIntent(userId: string) {
    const user = await this.userRepository.findOneBy({ userId });
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
  async getPaymentMethods(userId: string) {
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
}
