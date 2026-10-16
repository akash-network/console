import { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { LeaseService, type LeaseSigner } from "@src/deployment/services/lease/lease.service";
import { createdLeaseActivityOf, failedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
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

  /** Creating the leases is safe to repeat, so a failure is retried and settles the activity only once it is a refusal or the last attempt. */
  async handle(data: JobPayload<CreateLease>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    const signer = await this.#signerOf(data, job);
    if (!signer) return;

    try {
      await this.leaseService.createQueuedLeases(signer, data.leases);
    } catch (error) {
      if (isRefusalOnFirstAttempt(error, job)) return await this.#refuse(data, error);

      await this.#failOnLastAttempt(data, error, job);
      throw error;
    }

    await this.activityService.settle(data.activityId, createdLeaseActivityOf(data));
  }

  /** Retrying cannot give back a wallet the job may no longer sign with, so that refusal is final on any attempt. */
  async #signerOf(data: JobPayload<CreateLease>, job?: JobMeta): Promise<LeaseSigner | undefined> {
    try {
      return { wallet: await this.walletReaderService.getWalletById(data.walletId), userId: data.userId };
    } catch (error) {
      if (!isRefusal(error)) {
        await this.#failOnLastAttempt(data, error, job);
        throw error;
      }

      await this.#refuse(data, error);
      return undefined;
    }
  }

  async #refuse({ userId, leases, activityId }: JobPayload<CreateLease>, error: unknown): Promise<void> {
    this.#logger.warn({ event: "BACKGROUND_LEASE_REFUSED", activityId, dseq: leases[0].dseq, error });
    await this.activityService.settle(activityId, failedLeaseActivityOf({ userId, leases }, error));
  }

  async #failOnLastAttempt({ userId, leases, activityId }: JobPayload<CreateLease>, error: unknown, job?: JobMeta): Promise<void> {
    if (isLastAttempt(job)) await this.activityService.settle(activityId, failedLeaseActivityOf({ userId, leases }, error));
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}

function isRefusal(error: unknown): boolean {
  return isHttpError(error) && error.status < 500;
}

/** Only a first attempt's refusal is final, since a later one may be refused over a lease an earlier attempt landed out of sight, and a manifest the provider refused is retried because its lease already exists. */
function isRefusalOnFirstAttempt(error: unknown, job?: JobMeta): boolean {
  if (!isRefusal(error) || job?.retryCount) return false;

  return (error as { errorCode?: string }).errorCode !== "manifest_not_delivered";
}
