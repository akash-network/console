import { type Job, JOB_NAME } from "@src/core/services/job-queue/job-queue.service";

/** Carries what the charge says the payer still paid, because the payment row that recorded it went with the payer's account. */
export type DeletedPaymentReversal = { reason: "refund"; amount: number; amountRefunded: number } | { reason: "dispute_lost" };

export class ReverseDeletedPaymentCommission implements Job {
  static readonly [JOB_NAME] = "ReverseDeletedPaymentCommission";
  readonly name = ReverseDeletedPaymentCommission[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { stripeChargeId: string; reversal: DeletedPaymentReversal }) {}
}
