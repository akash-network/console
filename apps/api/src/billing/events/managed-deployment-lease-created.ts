import type { DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";

export class ManagedDeploymentLeaseCreated implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "ManagedDeploymentLeaseCreated";

  public readonly name = ManagedDeploymentLeaseCreated[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      walletAddress: string;
      dseq: string;
    }
  ) {}
}
