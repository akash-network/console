import { formatDistanceToNow } from "date-fns";
import escapeHtml from "lodash/escape";

import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationInvitationOutput } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";

const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "an owner",
  admin: "an admin",
  member: "a member",
  billing: "a billing manager",
  viewer: "a viewer"
};

export function organizationInvitationEmailNotification(input: {
  invitation: Pick<OrganizationInvitationOutput, "id" | "email" | "role" | "expiresAt">;
  organizationName: string;
  inviterName: string | null | undefined;
  invitationUrl: string;
  sendId: string;
}): CreateNotificationInput {
  const { invitation, organizationName, inviterName, invitationUrl, sendId } = input;
  const inviter = inviterName ? `${escapeHtml(inviterName)} invited you` : "You have been invited";

  return {
    notificationId: `organizationInvitation.${invitation.id}.${sendId}`,
    payload: {
      summary: `Join ${organizationName} on Akash Console`,
      description:
        `<p>${inviter} to join <strong>${escapeHtml(organizationName)}</strong> on Akash Console as ${ROLE_DESCRIPTIONS[invitation.role]}.</p>` +
        `<p>The invitation expires in ${formatDistanceToNow(invitation.expiresAt)}. If you weren't expecting it, you can ignore this email.</p>`,
      actions: [{ label: "Accept invitation", url: invitationUrl }]
    },
    user: { id: emailRecipientUserId(invitation.email), email: invitation.email }
  };
}
