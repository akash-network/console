import { type Job, JOB_NAME } from "@src/core";

/** Queued by admin-api in the transaction that records the event, so its name and payload are a contract with console-private. */
export class AccountStatusChanged implements Job {
  static readonly [JOB_NAME] = "AccountStatusChanged";
  readonly name = AccountStatusChanged[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { eventId: string }) {}
}

export function accountStatusChangedKeyFor(eventId: string): string {
  return `accountStatusChanged.${eventId}`;
}
