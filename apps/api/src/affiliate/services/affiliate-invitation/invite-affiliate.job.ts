import { type Job, JOB_NAME } from "@src/core";

export class InviteAffiliate implements Job {
  static readonly [JOB_NAME] = "InviteAffiliate";
  readonly name = InviteAffiliate[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userId: string }) {}
}

export function inviteAffiliateKeyFor(userId: string): string {
  return `invite-affiliate:${userId}`;
}
