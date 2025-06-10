import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UserOutput } from "@src/user/repositories";

interface CheckoutSessionOptions {
  user: UserOutput;
  redirectUrl: string;
  amount?: string;
}

@singleton()
export class CheckoutService {
  constructor(
    private readonly stripe: StripeService,
    private readonly checkoutSessionRepository: CheckoutSessionRepository
  ) {}

  async checkoutFor({ user, redirectUrl, amount }: CheckoutSessionOptions) {
    const stripeCustomerId = await this.stripe.getStripeCustomerId(user);

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
}
