import Stripe from "stripe";
import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UserOutput, UserRepository } from "@src/user/repositories";

interface CheckoutSessionOptions {
  user: UserOutput;
  redirectUrl: string;
  amount?: string;
}

@singleton()
export class CheckoutService {
  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository,
    private readonly checkoutSessionRepository: CheckoutSessionRepository
  ) {}

  async checkoutFor({ user, redirectUrl, amount }: CheckoutSessionOptions): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    const stripeCustomerId = await this.getStripeCustomerId(user);
    const session = await this.stripe.startCheckoutSession({
      customerId: stripeCustomerId,
      redirectUrl,
      amount
    });

    await this.checkoutSessionRepository.create({
      sessionId: session.id,
      userId: user.id
    });

    return session;
  }

  private async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      name: user.username ?? undefined,
      metadata: {
        userId: user.userId
      }
    });

    await this.userRepository.updateById(user.id, {
      stripeCustomerId: customer.id
    });

    return customer.id;
  }
}
