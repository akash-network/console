import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UserOutput, UserRepository } from "@src/user/repositories";

@singleton()
export class CheckoutService {
  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository,
    private readonly checkoutSessionRepository: CheckoutSessionRepository
  ) {}

  async checkoutFor(user: UserOutput, redirectUrl: string) {
    const { stripeCustomerId } = await this.ensureCustomer(user);

    const session = await this.stripe.startCheckoutSession({
      customerId: stripeCustomerId,
      redirectUrl
    });

    await this.checkoutSessionRepository.create({
      sessionId: session.id,
      userId: user.id
    });

    return session;
  }

  private async ensureCustomer<T extends UserOutput>(user: T): Promise<Omit<T, "stripeCustomerId"> & Required<Pick<T, "stripeCustomerId">>> {
    if (user.stripeCustomerId) {
      return user;
    }

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

    return {
      ...user,
      stripeCustomerId: customer.id
    };
  }
}
