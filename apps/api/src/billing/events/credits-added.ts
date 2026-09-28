import type { StripeTransactionType } from "@src/billing/repositories";
import { DOMAIN_EVENT_NAME, type DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import type { UserOutput } from "@src/user/repositories";

export class CreditsAdded implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "CreditsAdded";
  public readonly name = CreditsAdded[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      transactionId: string;
      source: StripeTransactionType;
      isAutoRecharge: boolean;
      paidAmountCents: number;
      bonusAmountCents: number;
    }
  ) {}
}
