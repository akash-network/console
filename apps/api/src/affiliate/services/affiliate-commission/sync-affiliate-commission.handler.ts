import { singleton } from "tsyringe";

import { type JobHandler, type JobPayload, type JobPermissions } from "@src/core/services/job-queue/job-queue.service";
import { AffiliateCommissionService } from "./affiliate-commission.service";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

@singleton()
export class SyncAffiliateCommissionHandler implements JobHandler<SyncAffiliateCommission> {
  readonly accepts = SyncAffiliateCommission;

  constructor(private readonly affiliateCommissionService: AffiliateCommissionService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ transactionId }: JobPayload<SyncAffiliateCommission>): Promise<void> {
    await this.affiliateCommissionService.syncCommission(transactionId);
  }
}
