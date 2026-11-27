import { singleton } from "tsyringe";

import { FundingWalletMoveService } from "@src/billing/services/funding-wallet-move/funding-wallet-move.service";
import type { JobHandler, JobPayload, JobPermissions } from "@src/core";
import { MoveUserToActiveFundingWallet } from "./move-user-to-active-funding-wallet.job";

@singleton()
export class MoveUserToActiveFundingWalletHandler implements JobHandler<MoveUserToActiveFundingWallet> {
  public readonly accepts = MoveUserToActiveFundingWallet;

  /** Funding transactions are unordered, so moves of different users run side by side; this bounds how many the signer signs for at once. */
  public readonly concurrency = 8;

  /** With the per-user-wallet singletonKey of its jobs, keeps two queued moves of one user from running at once, which a `standard` queue would not. */
  public readonly policy = "singleton";

  constructor(private readonly fundingWalletMoveService: FundingWalletMoveService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A failed run is retried as it is, because the move resumes from the record it saved. */
  async handle({ userWalletId }: JobPayload<MoveUserToActiveFundingWallet>): Promise<void> {
    await this.fundingWalletMoveService.moveToActive(userWalletId);
  }
}
