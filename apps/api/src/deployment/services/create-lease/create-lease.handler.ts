import { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { LeaseService } from "@src/deployment/services/lease/lease.service";
import { createdLeaseActivityOf, failedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { CreateLease } from "./create-lease.job";

@singleton()
export class CreateLeaseHandler implements JobHandler<CreateLease> {
  public readonly accepts = CreateLease;

  /** One lease creation per deployment across queued, retrying and running, so a second request joins the first instead of racing it for the same bids. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly leaseService: LeaseService,
    private readonly activityService: ActivityService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: CreateLeaseHandler.name });
  }

  /** The manifest is derived from the stored definition, which reads the deployment's settings under the owner's ability. */
  requiresPermission({ userId }: JobPayload<CreateLease>): JobPermissions {
    return [
      { action: "sign", subject: "UserWallet", conditions: { userId } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId } }
    ];
  }

  /** Creating the leases is safe to repeat, so a failure is retried and settles the activity only once it is a refusal or the last attempt. */
  async handle({ userId, leases, activityId }: JobPayload<CreateLease>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    try {
      await this.leaseService.createQueuedLeases({ userId, leases });
    } catch (error) {
      if (isRefusalOnFirstAttempt(error, job)) {
        this.#logger.warn({ event: "BACKGROUND_LEASE_REFUSED", activityId, dseq: leases[0].dseq, error });
        return await this.activityService.settle(activityId, failedLeaseActivityOf({ userId, leases }, error));
      }

      if (isLastAttempt(job)) await this.activityService.settle(activityId, failedLeaseActivityOf({ userId, leases }, error));
      throw error;
    }

    await this.activityService.settle(activityId, createdLeaseActivityOf({ userId, leases }));
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}

/** Only a first attempt's refusal is final, since a later one may be refused over a lease an earlier attempt landed out of sight, and a manifest the provider refused is retried because its lease already exists. */
function isRefusalOnFirstAttempt(error: unknown, job?: JobMeta): boolean {
  if (!isHttpError(error) || error.status >= 500 || job?.retryCount) return false;

  return (error as { errorCode?: string }).errorCode !== "manifest_not_delivered";
}
