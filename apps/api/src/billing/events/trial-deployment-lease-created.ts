import type { DomainEvent } from "@src/core/services/domain-events/domain-events.service";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";

export class TrialDeploymentLeaseCreated implements DomainEvent {
  static readonly [DOMAIN_EVENT_NAME] = "TrialDeploymentLeaseCreated";

  public readonly name = TrialDeploymentLeaseCreated[DOMAIN_EVENT_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
      /**
       * The date and time the deployment was created in ISO string format.
       */
      createdAt: string;
      isFirstLease: boolean;
    }
  ) {}
}
