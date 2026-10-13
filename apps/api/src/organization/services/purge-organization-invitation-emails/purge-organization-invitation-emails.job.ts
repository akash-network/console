import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

export class PurgeOrganizationInvitationEmailsJob implements Job {
  static readonly [JOB_NAME] = "PurgeOrganizationInvitationEmailsJob";
  readonly name = PurgeOrganizationInvitationEmailsJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { organizationId: string }) {}
}

export function purgeOrganizationInvitationEmailsKeyFor(organizationId: string): string {
  return `purgeOrganizationInvitationEmails.${organizationId}`;
}

export function purgeOrganizationInvitationEmailsOptionsFor(organizationId: string, purgeAt: Date): EnqueueOptions {
  return { singletonKey: purgeOrganizationInvitationEmailsKeyFor(organizationId), startAfter: purgeAt.toISOString() };
}
