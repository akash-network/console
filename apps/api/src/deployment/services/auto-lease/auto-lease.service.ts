import { randomUUID } from "node:crypto";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { JobQueueService } from "@src/core";
import { CreateLease, createLeaseKeyFor, leaseWalletRefOf } from "@src/deployment/services/create-lease/create-lease.job";
import type { AcceptedDeploymentCreate } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { matchingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { AUTO_LEASE_RETRY_OPTIONS, AutoLease, autoLeaseKeyFor } from "./auto-lease.job";

@singleton()
export class AutoLeaseService {
  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService
  ) {}

  /** Meant for the transaction that settles the create, so a created one-click deployment never lacks the match that leases it; a lease or a match already queued for the deployment carries on in its place. */
  async start({ userId, walletId, dseq }: Pick<AcceptedDeploymentCreate, "userId" | "walletId" | "dseq">): Promise<void> {
    const wallet = await this.walletReaderService.getWalletById(walletId);
    if (await this.jobQueueService.findPendingJobData(CreateLease, createLeaseKeyFor({ owner: wallet.address, dseq }))) return;

    const activityId = randomUUID();
    const jobId = await this.jobQueueService.enqueue(
      new AutoLease({ userId, ...leaseWalletRefOf(wallet), owner: wallet.address, dseq, activityId, startedAt: new Date().toISOString() }),
      { singletonKey: autoLeaseKeyFor({ owner: wallet.address, dseq }), ...AUTO_LEASE_RETRY_OPTIONS }
    );
    if (!jobId) return;

    await this.activityService.open({ id: activityId, ...matchingLeaseActivityOf({ userId, dseq }), organizationId: wallet.organizationId });
  }
}
