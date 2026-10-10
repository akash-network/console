import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { organizationInvitationEmailNotification } from "./organization-invitation-email-notification";

import { createOrganizationInvitation } from "@test/seeders/organization.seeder";

describe(organizationInvitationEmailNotification.name, () => {
  it("invites the address to the organization with a link to accept", () => {
    const invitation = createOrganizationInvitation({ email: "jane@example.com", role: "admin", expiresAt: addDays(new Date(), 7) });

    const notification = organizationInvitationEmailNotification({
      invitation,
      organizationName: "Acme",
      inviterName: "bob",
      invitationUrl: "https://console.akash.network/invitations#token=token",
      sendId: "send-1"
    });

    expect(notification).toEqual({
      notificationId: `organizationInvitation.${invitation.id}.send-1`,
      payload: {
        summary: "Join Acme on Akash Console",
        description:
          "<p>bob invited you to join <strong>Acme</strong> on Akash Console as an admin.</p>" +
          "<p>The invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>",
        actions: [{ label: "Accept invitation", url: "https://console.akash.network/invitations#token=token" }]
      },
      user: { id: emailRecipientUserId("jane@example.com"), email: "jane@example.com" }
    });
  });

  it.each<[OrganizationRole, string]>([
    ["owner", "an owner"],
    ["admin", "an admin"],
    ["member", "a member"],
    ["billing", "a billing manager"],
    ["viewer", "a viewer"]
  ])("describes the %s role as %s", (role, description) => {
    const notification = setup({ role });

    expect(notification.payload.description).toContain(`on Akash Console as ${description}.</p>`);
  });

  it("escapes the organization and inviter names in the markup", () => {
    const notification = setup({ organizationName: "<b>Acme</b>", inviterName: "<i>bob</i>" });

    expect(notification.payload.description).toContain("&lt;i&gt;bob&lt;/i&gt; invited you to join <strong>&lt;b&gt;Acme&lt;/b&gt;</strong>");
  });

  it("does not name an inviter whose account is gone", () => {
    const notification = setup({ inviterName: null });

    expect(notification.payload.description).toMatch(/^<p>You have been invited to join /);
  });

  function setup(input: { role?: OrganizationRole; organizationName?: string; inviterName?: string | null }) {
    return organizationInvitationEmailNotification({
      invitation: createOrganizationInvitation({ role: input.role }),
      organizationName: input.organizationName ?? "Acme",
      inviterName: input.inviterName === undefined ? "bob" : input.inviterName,
      invitationUrl: "https://console.akash.network/invitations#token=token",
      sendId: "send-1"
    });
  }
});
