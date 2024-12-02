import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { StripePricesOutputResponse } from "@src/billing";
import { StripeService } from "@src/billing/services/stripe/stripe.service";

@singleton()
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  @Protected([{ action: "read", subject: "StripePrice" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }
}
