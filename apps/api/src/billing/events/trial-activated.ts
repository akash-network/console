import { DOMAIN_EVENT_NAME, type DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import type { UserOutput } from "@src/user/repositories";

export class TrialActivated implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "TrialActivated";
  public readonly name = TrialActivated[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
    }
  ) {}
}
