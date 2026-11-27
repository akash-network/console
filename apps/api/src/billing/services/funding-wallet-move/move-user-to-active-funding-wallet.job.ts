import { type Job, JOB_NAME } from "@src/core";

export function moveUserToActiveFundingWalletKeyFor(network: string, userWalletId: number): string {
  return `${network}.${userWalletId}`;
}

/** Moves one user wallet's balance off the draining funding wallet; enqueue it with the key above, so one user is never moved by two runs at once. */
export class MoveUserToActiveFundingWallet implements Job {
  static readonly [JOB_NAME] = "MoveUserToActiveFundingWallet";
  readonly name = MoveUserToActiveFundingWallet[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userWalletId: number }) {}
}
