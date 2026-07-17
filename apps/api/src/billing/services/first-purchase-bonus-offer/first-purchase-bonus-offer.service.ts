import { injectable } from "tsyringe";

import { StripeTransactionRepository } from "@src/billing/repositories";
import { BONUS_PERCENT, MAX_BONUS_CENTS, MIN_QUALIFYING_AMOUNT_CENTS } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { Resolver } from "@src/core/providers/resolvers.provider";
import { DATA_RESOLVER } from "@src/core/providers/resolvers.provider";
import type { UserOutput } from "@src/user/repositories";

export interface FirstPurchaseBonusOffer {
  bonusPercent: number;
  minPurchaseUsd: number;
  maxBonusUsd: number;
}

/**
 * Resolves the live first-purchase bonus offer for trial emails at send time (emails are
 * scheduled days/weeks ahead). Returns null when the offer doesn't apply so the email still
 * sends without the pitch; DB errors propagate so pg-boss retries the notification.
 */
@injectable({ token: DATA_RESOLVER })
export class FirstPurchaseBonusOfferService implements Resolver {
  readonly key = "firstPurchaseBonus";

  constructor(private readonly stripeTransactionRepository: StripeTransactionRepository) {}

  async resolve(user: UserOutput): Promise<FirstPurchaseBonusOffer | null> {
    if (await this.stripeTransactionRepository.hasCompletedPaidTransaction(user.id)) return null;

    return {
      bonusPercent: BONUS_PERCENT,
      minPurchaseUsd: MIN_QUALIFYING_AMOUNT_CENTS / 100,
      maxBonusUsd: MAX_BONUS_CENTS / 100
    };
  }
}
