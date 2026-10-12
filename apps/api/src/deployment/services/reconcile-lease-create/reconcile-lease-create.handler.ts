import { subMinutes } from "date-fns";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type JobHandler, type JobPayload, type JobPermissions, JobQueueService } from "@src/core";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { LeaseService } from "@src/deployment/services/lease/lease.service";
import { notCreatedLeaseActivityOf, undeliveredManifestActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { RECONCILE_LEASE_CREATE_DELAY_IN_MIN, ReconcileLeaseCreate, reconcileLeaseCreateOptionsFor } from "./reconcile-lease-create.job";

@singleton()
export class ReconcileLeaseCreateHandler implements JobHandler<ReconcileLeaseCreate> {
  public readonly accepts = ReconcileLeaseCreate;

  /** One waiting check per activity, so a run retried after it already queued the next check queues no second one. */
  public readonly policy = "short";

  constructor(
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService,
    private readonly leaseService: LeaseService
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  /** The leases are read only once nothing the lease job sent can still land; leases found then still owe their provider a manifest, which a background lease's job is queued again to send. */
  async handle({ version: _version, ...data }: JobPayload<ReconcileLeaseCreate>): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    if (await this.#mayLeaseStillLand(data.createLeaseJobId)) {
      return await this.#checkAgainLater(data);
    }

    if (!(await this.leaseService.leasesExist(data.owner, data.leases))) {
      return await this.activityService.settle(data.activityId, notCreatedLeaseActivityOf(data));
    }

    if (!data.createLeaseJobId) {
      return await this.activityService.settle(data.activityId, undeliveredManifestActivityOf(data));
    }

    await this.#finishInBackground(data);
  }

  async #mayLeaseStillLand(createLeaseJobId?: string): Promise<boolean> {
    if (!createLeaseJobId) return false;

    const createLeaseJob = await this.jobQueueService.findJob(CreateLease, createLeaseJobId);
    if (!createLeaseJob) return false;

    return !createLeaseJob.completedOn || createLeaseJob.completedOn > subMinutes(new Date(), RECONCILE_LEASE_CREATE_DELAY_IN_MIN);
  }

  async #checkAgainLater(data: ReconcileLeaseCreate["data"]): Promise<void> {
    await this.jobQueueService.enqueue(new ReconcileLeaseCreate(data), reconcileLeaseCreateOptionsFor(data.activityId, new Date()));
  }

  /** While another lease job holds the deployment, the next check queues this one again. */
  async #finishInBackground({ userId, owner, leases, activityId, createLeaseJobId }: ReconcileLeaseCreate["data"]): Promise<void> {
    const jobId = await this.jobQueueService.enqueue(new CreateLease({ userId, leases, activityId }), {
      singletonKey: createLeaseKeyFor({ owner, dseq: leases[0].dseq }),
      ...CREATE_LEASE_RETRY_OPTIONS
    });

    await this.#checkAgainLater({ userId, owner, leases, activityId, createLeaseJobId: jobId ?? createLeaseJobId });
  }
}
