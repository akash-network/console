import { type Job, JOB_NAME } from "@src/core";

export type AllowanceWallet = { id: number; address: string };

/** A grant of the deployment allowance and the read it was computed from, since what lands between the two is what the grant overwrites. */
export type AllowanceWrite = {
  txHash: string;
  readHeight: number;
  readLimit: number;
  sentAt: string;
};

export type AllowanceCheck = {
  wallet: AllowanceWallet;
  write: AllowanceWrite;
  /** What the write moved the allowance by, written again if it never lands; zero for a write whose own caller retries it. */
  adjustment: number;
  /** Follow-up writes made so far for the write that started this chain. */
  round: number;
  attempt: number;
};

/** Restores what a deployment allowance grant overwrote between its read and its landing, with a follow-up grant that is checked the same way. */
export class ReconcileDeploymentAllowance implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentAllowance";
  readonly name = ReconcileDeploymentAllowance[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: AllowanceCheck) {}
}
