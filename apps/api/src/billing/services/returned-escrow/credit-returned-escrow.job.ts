import { type Job, JOB_NAME } from "@src/core";

/** Credits the escrow that deployments of one user wallet returned to a funding wallet it has moved off; `closeTxHash` names a close just sent, which the chain index may not hold yet. */
export class CreditReturnedEscrow implements Job {
  static readonly [JOB_NAME] = "CreditReturnedEscrow";
  readonly name = CreditReturnedEscrow[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userWalletId: number; closeTxHash?: string }) {}
}
