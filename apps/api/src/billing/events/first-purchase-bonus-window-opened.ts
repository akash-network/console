import type { BonusWindowReason } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { DOMAIN_EVENT_NAME, type DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import type { UserOutput } from "@src/user/repositories";

export type EmailedBonusWindowReason = Extract<BonusWindowReason, "small_first_purchase" | "gpu_win_back">;

export class FirstPurchaseBonusWindowOpened implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "FirstPurchaseBonusWindowOpened";
  public readonly name = FirstPurchaseBonusWindowOpened[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      reason: EmailedBonusWindowReason;
      /** Null for a win-back to a person who never paid, who keeps the bonus until their first purchase. */
      closesAt: string | null;
    }
  ) {}
}
