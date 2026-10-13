import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { FirstPurchaseBonusResponse } from "@src/billing/http-schemas/stripe.schema";
import { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { billingOwnerOf } from "@src/billing/services/payer/payer";
import { PayerService } from "@src/billing/services/payer/payer.service";

@singleton()
export class FirstPurchaseBonusController {
  constructor(
    private readonly payerService: PayerService,
    private readonly firstPurchaseBonusService: FirstPurchaseBonusService
  ) {}

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getFirstPurchaseBonus(): Promise<FirstPurchaseBonusResponse> {
    const payer = await this.payerService.getCurrentPayer();

    return { data: { eligible: await this.firstPurchaseBonusService.isEligible(billingOwnerOf(payer), payer.user.id) } };
  }
}
