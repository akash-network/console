import createError from "http-errors";
import { singleton } from "tsyringe";

import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationInvitationOutput } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import {
  type InvitationEmailSend,
  OrganizationInvitationEmailRepository
} from "@src/organization/repositories/organization-invitation-email/organization-invitation-email.repository";
import { UserRepository } from "@src/user/repositories";

export const INVITATION_EMAIL_LIMIT_ERROR_CODE = "invitation_email_limit_reached";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Each limit must stay at or above the most addresses one request may name, or a full request could never fit. */
export const INVITATION_EMAIL_LIMITS = {
  perOrganization: 50,
  perSender: 50,
  perAddress: 3
} as const;

@singleton()
export class InvitationEmailLimiter {
  constructor(
    private readonly emailRepository: OrganizationInvitationEmailRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository
  ) {}

  /** Call it inside the transaction that records the sends; it locks the organization row, then the sender row, so callers taking both keep that order. */
  async assertWithinLimits({ organizationId, senderId, emails }: { organizationId: string; senderId: string; emails: string[] }): Promise<void> {
    if (emails.length === 0) return;

    await this.organizationRepository.findOneByAndLock({ id: organizationId });
    await this.userRepository.findOneByAndLock({ id: senderId });
    const windowStart = new Date(Date.now() - WINDOW_MS);
    const organizationSends = await this.emailRepository.findSendsSince({ organizationId }, windowStart);
    const senderSends = await this.emailRepository.findSendsSince({ sentByUserId: senderId }, windowStart);

    const waits = [
      secondsUntilRoom(organizationSends, emails.length, INVITATION_EMAIL_LIMITS.perOrganization, windowStart),
      secondsUntilRoom(senderSends, emails.length, INVITATION_EMAIL_LIMITS.perSender, windowStart),
      ...emails.map(email =>
        secondsUntilRoom(
          organizationSends.filter(send => send.email === email),
          1,
          INVITATION_EMAIL_LIMITS.perAddress,
          windowStart
        )
      )
    ].filter(wait => wait !== undefined);

    if (waits.length === 0) return;

    throw createError(429, "Too many invitation emails were sent recently. Try again later.", {
      errorCode: INVITATION_EMAIL_LIMIT_ERROR_CODE,
      headers: { "Retry-After": String(Math.max(...waits)) }
    });
  }

  async recordSends(invitations: Pick<OrganizationInvitationOutput, "id" | "organizationId">[], senderId: string): Promise<void> {
    await this.emailRepository.recordSends(
      invitations.map(invitation => ({ organizationId: invitation.organizationId, invitationId: invitation.id, sentByUserId: senderId }))
    );
  }
}

/** `sends` is oldest first; room for `count` more opens once the oldest sends over the limit leave the window. */
function secondsUntilRoom(sends: InvitationEmailSend[], count: number, limit: number, windowStart: Date): number | undefined {
  const excess = sends.length + count - limit;

  if (excess <= 0) return undefined;

  return Math.ceil((sends[excess - 1].createdAt.getTime() - windowStart.getTime()) / 1000);
}
