import type { DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";

/** Every lease the console signs, trialing or not, as distinct from `TrialDeploymentLeaseCreated` which covers only trials. */
export class ManagedDeploymentLeaseCreated implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "ManagedDeploymentLeaseCreated";

  public readonly name = ManagedDeploymentLeaseCreated[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
      /** The date and time the lease was created in ISO string format. */
      createdAt: string;
    }
  ) {}
}
