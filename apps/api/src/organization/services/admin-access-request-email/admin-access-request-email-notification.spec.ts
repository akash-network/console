import { describe, expect, it } from "vitest";

import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationMemberWithUser } from "@src/organization/repositories/organization-member/organization-member.repository";
import { adminAccessRequestEmailNotification } from "./admin-access-request-email-notification";

import { createOrganization, createOrganizationMemberWithUser } from "@test/seeders/organization.seeder";

describe(adminAccessRequestEmailNotification.name, () => {
  it("tells the owner who wants to be an admin, with a link to the members page", () => {
    const owner = createOrganizationMemberWithUser({ role: "owner", email: "owner@example.com" });
    const requester = createOrganizationMemberWithUser({ role: "member", username: "alex", email: "alex@example.com" });
    const organization = createOrganization({ name: "Acme" });

    const notification = adminAccessRequestEmailNotification({
      owner,
      requester,
      organization,
      membersUrl: "https://console.akash.network/members?org=org-1",
      requestedAt: "2026-10-26T12:00:00.000Z"
    });

    expect(notification).toEqual({
      notificationId: `adminAccessRequest.${organization.id}.${requester.userId}.${owner.userId}.2026-10-26T12:00:00.000Z`,
      payload: {
        summary: "alex wants to be an admin of Acme",
        description:
          "<p><strong>alex</strong> (alex@example.com) asked to become an admin of <strong>Acme</strong> on Akash Console. They're a member today.</p>" +
          "<p>Admins create projects, manage members and see billing and usage. You can change their role from the Members page. " +
          "If you weren't expecting this, you can ignore this email.</p>",
        actions: [{ label: "Review members", url: "https://console.akash.network/members?org=org-1" }]
      },
      user: { id: owner.userId, email: "owner@example.com" }
    });
  });

  it.each<[OrganizationRole, string]>([
    ["member", "a member"],
    ["billing", "a billing manager"],
    ["viewer", "a viewer"]
  ])("describes a requester with role %s as %s", (role, description) => {
    const notification = setup({ requester: { role } });

    expect(notification.payload.description).toContain(`They're ${description} today.</p>`);
  });

  it("names a requester without a username by their email alone", () => {
    const notification = setup({ requester: { username: null, email: "alex@example.com" } });

    expect(notification.payload.summary).toBe("alex@example.com wants to be an admin of Acme");
    expect(notification.payload.description).toMatch(/^<p><strong>alex@example.com<\/strong> asked to become/);
  });

  it("falls back to a generic name for a requester with neither a username nor an email", () => {
    const notification = setup({ requester: { username: null, email: null } });

    expect(notification.payload.summary).toBe("A member wants to be an admin of Acme");
    expect(notification.payload.description).toMatch(/^<p><strong>A member<\/strong> asked to become/);
  });

  it("escapes the requester and organization names in the markup", () => {
    const notification = setup({ requester: { username: "<i>alex</i>", email: "<b>@example.com" }, organizationName: "<b>Acme</b>" });

    expect(notification.payload.description).toContain(
      "<strong>&lt;i&gt;alex&lt;/i&gt;</strong> (&lt;b&gt;@example.com) asked to become an admin of <strong>&lt;b&gt;Acme&lt;/b&gt;</strong>"
    );
  });

  function setup(input: { requester?: Partial<OrganizationMemberWithUser>; organizationName?: string }) {
    return adminAccessRequestEmailNotification({
      owner: createOrganizationMemberWithUser({ role: "owner" }),
      requester: createOrganizationMemberWithUser({ role: "member", ...input.requester }),
      organization: createOrganization({ name: input.organizationName ?? "Acme" }),
      membersUrl: "https://console.akash.network/members",
      requestedAt: "2026-10-26T12:00:00.000Z"
    });
  }
});
