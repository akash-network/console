import { describe, expect, it } from "vitest";

import { teamOrganizationDeletedNotification } from "./team-organization-deleted-notification";

describe(teamOrganizationDeletedNotification.name, () => {
  it("tells the member who deleted which team, once per member and team", () => {
    const result = teamOrganizationDeletedNotification(
      { id: "user-123", email: "member@example.com" },
      { organizationId: "org-456", organizationName: "Acme Corp", deletedByName: "alice" }
    );

    expect(result).toEqual({
      notificationId: "teamOrganizationDeleted.org-456.user-123",
      payload: {
        summary: "Acme Corp was deleted on Akash Console",
        description:
          "<p>alice deleted the team <strong>Acme Corp</strong> on Akash Console. You no longer have access to its projects, deployments, API keys or billing.</p>" +
          "<p>Any credits it had left were forfeited and its saved cards were removed. Its payment and deployment history is kept on record.</p>"
      },
      user: { id: "user-123", email: "member@example.com" }
    });
  });

  it("names no one when the owner who deleted the team has no name", () => {
    const result = teamOrganizationDeletedNotification(
      { id: "user-123", email: "member@example.com" },
      { organizationId: "org-456", organizationName: "Acme Corp", deletedByName: null }
    );

    expect(result.payload.description).toMatch(/^<p>An owner deleted the team /);
  });

  it("escapes the team and owner names in the email body", () => {
    const result = teamOrganizationDeletedNotification(
      { id: "user-123", email: "member@example.com" },
      { organizationId: "org-456", organizationName: "<b>Acme</b>", deletedByName: "<i>alice</i>" }
    );

    expect(result.payload.description).toContain("&lt;i&gt;alice&lt;/i&gt; deleted the team <strong>&lt;b&gt;Acme&lt;/b&gt;</strong>");
  });
});
