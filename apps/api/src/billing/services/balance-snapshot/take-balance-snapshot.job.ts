import { type Job, JOB_NAME } from "@src/core";

/** Stores every user's on-chain balance under the given UTC day. */
export class TakeBalanceSnapshot implements Job {
  static readonly [JOB_NAME] = "TakeBalanceSnapshot";
  readonly name = TakeBalanceSnapshot[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { takenOn: string }) {}
}

export function takeBalanceSnapshotKeyFor(network: string, takenOn: string): string {
  return `takeBalanceSnapshot.${network}.${takenOn}`;
}
