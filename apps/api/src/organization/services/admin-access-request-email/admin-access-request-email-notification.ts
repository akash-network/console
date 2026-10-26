import escapeHtml from "lodash/escape";

import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";
import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationMemberWithUser } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ROLE_DESCRIPTIONS } from "@src/organization/services/organization-invitation-email/organization-invitation-email-notification";

/** Names are whatever people typed, so they are escaped before going into the markup; the summary stays plain text, which the email layout escapes. */
export function adminAccessRequestEmailNotification(input: {
  owner: Pick<OrganizationMemberWithUser, "userId" | "email">;
  requester: Pick<OrganizationMemberWithUser, "userId" | "username" | "email" | "role">;
  organization: Pick<OrganizationOutput, "id" | "name">;
  membersUrl: string;
  requestedAt: string;
}): CreateNotificationInput {
  const { owner, requester, organization, membersUrl, requestedAt } = input;
  const requesterName = requester.username || requester.email || "A member";
  const requesterEmail = requester.username && requester.email ? ` (${escapeHtml(requester.email)})` : "";

  return {
    notificationId: `adminAccessRequest.${organization.id}.${requester.userId}.${owner.userId}.${requestedAt}`,
    payload: {
      summary: `${requesterName} wants to be an admin of ${organization.name}`,
      description:
        `<p><strong>${escapeHtml(requesterName)}</strong>${requesterEmail} asked to become an admin of <strong>${escapeHtml(organization.name)}</strong> ` +
        `on Akash Console. They're ${ROLE_DESCRIPTIONS[requester.role]} today.</p>` +
        `<p>Admins create projects, manage members and see billing and usage. You can change their role from the Members page. ` +
        `If you weren't expecting this, you can ignore this email.</p>`,
      actions: [{ label: "Review members", url: membersUrl }]
    },
    user: { id: owner.userId, email: owner.email }
  };
}
