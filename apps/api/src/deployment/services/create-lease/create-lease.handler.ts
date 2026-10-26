import { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { LeaseService, type QueuedLeaseSigner } from "@src/deployment/services/lease/lease.service";
import { isAccessRevoked, MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { createdLeaseActivityOf, failedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { isManifestInvalid } from "@src/provider/services/provider/provider.service";
import { CreateLease } from "./create-lease.job";

@singleton()
export class CreateLeaseHandler implements JobHandler<CreateLease> {
  public readonly accepts = CreateLease;

  /** One lease creation per deployment across queued, retrying and running, so a second request joins the first instead of racing it for the same bids. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseService: LeaseService,
    private readonly activityService: ActivityService,
    private readonly memberDeploymentAccessService: MemberDeploymentAccessService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: CreateLeaseHandler.name });
  }

  /** The manifest is derived from the stored definition, which a team wallet files under its organization rather than under the member who asked. */
  requiresPermission({ userId, walletId, organizationId, leases }: JobPayload<CreateLease>): JobPermissions {
    const { dseq } = leases[0];

    return [
      { action: "sign", subject: "UserWallet", conditions: { id: walletId } },
      { action: "read", subject: "DeploymentSetting", conditions: organizationId === undefined ? { userId, dseq } : { organizationId, dseq } }
    ];
  }

  /** Creating the leases is safe to repeat, so a failure is retried and settles the activity only once it is final or the last attempt. */
  async handle(data: JobPayload<CreateLease>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    try {
      await this.leaseService.createQueuedLeases(await this.#signerOf(data), data.leases);
    } catch (error) {
      if (isFinal(error, job)) return await this.#refuse(data, error);
      if (isLastAttempt(job)) await this.activityService.settle(data.activityId, failedLeaseActivityOf(data, error));

      throw error;
    }

    await this.activityService.settle(data.activityId, createdLeaseActivityOf(data));
  }

  async #signerOf({ userId, walletId, leases }: JobPayload<CreateLease>): Promise<QueuedLeaseSigner> {
    return {
      wallet: await this.walletReaderService.getWalletById(walletId),
      userId,
      assertMayStillSign: () => this.memberDeploymentAccessService.assertMayStillSign({ userId, walletId, dseq: leases[0].dseq })
    };
  }

  async #refuse(data: JobPayload<CreateLease>, error: unknown): Promise<void> {
    this.#logger.warn({ event: "BACKGROUND_LEASE_REFUSED", activityId: data.activityId, dseq: data.leases[0].dseq, error });
    await this.activityService.settle(data.activityId, failedLeaseActivityOf(data, error));
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}

/** Access the member lost and a manifest the provider found invalid are final on any attempt, since no retry changes either; any other refusal is final only on the first attempt, since a later one may be refused over a lease an earlier attempt landed out of sight, and a manifest the provider did not receive is retried because its lease already exists. */
function isFinal(error: unknown, job?: JobMeta): boolean {
  if (isAccessRevoked(error) || isManifestInvalid(error)) return true;
  if (!isHttpError(error) || error.status >= 500 || job?.retryCount) return false;

  return (error as { errorCode?: string }).errorCode !== "manifest_not_delivered";
}
