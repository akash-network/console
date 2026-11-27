import createError from "http-errors";
import { singleton } from "tsyringe";

import { DeploymentAllowanceHistoryRepository } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import type { JobHandler, JobPayload, JobPermissions } from "@src/core";
import { CreditReturnedEscrow } from "./credit-returned-escrow.job";
import { ReturnedEscrowService } from "./returned-escrow.service";

@singleton()
export class CreditReturnedEscrowHandler implements JobHandler<CreditReturnedEscrow> {
  public readonly accepts = CreditReturnedEscrow;

  /** With the per-user-wallet singletonKey of its jobs, keeps two checks of one user from running at once, which a `standard` queue would not. */
  public readonly policy = "singleton";

  constructor(
    private readonly returnedEscrowService: ReturnedEscrowService,
    private readonly deploymentAllowanceHistoryRepository: DeploymentAllowanceHistoryRepository
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Fails, and is retried later, while the chain index has not stored the close it was queued for, since reading before that would find nothing and end the job. */
  async handle({ userWalletId, closeTxHash }: JobPayload<CreditReturnedEscrow>): Promise<void> {
    if (closeTxHash && !(await this.deploymentAllowanceHistoryRepository.findTx(closeTxHash))) {
      throw createError(503, "The chain index has not reached this close yet", { closeTxHash });
    }

    await this.returnedEscrowService.creditTo(userWalletId);
  }
}
