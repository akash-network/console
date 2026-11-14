import { singleton } from "tsyringe";

import { type JobHandler, type JobPayload, type JobPermissions } from "@src/core/services/job-queue/job-queue.service";
import { AffiliateCommissionService } from "./affiliate-commission.service";
import { ReverseDeletedPaymentCommission } from "./reverse-deleted-payment-commission.job";

@singleton()
export class ReverseDeletedPaymentCommissionHandler implements JobHandler<ReverseDeletedPaymentCommission> {
  readonly accepts = ReverseDeletedPaymentCommission;

  constructor(private readonly affiliateCommissionService: AffiliateCommissionService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ stripeChargeId, reversal }: JobPayload<ReverseDeletedPaymentCommission>): Promise<void> {
    await this.affiliateCommissionService.reverseCommissionsOfDeletedPayment(stripeChargeId, reversal);
  }
}
