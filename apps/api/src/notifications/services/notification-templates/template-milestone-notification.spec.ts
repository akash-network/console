import { describe, expect, it } from "vitest";

import { templateMilestoneNotification } from "./template-milestone-notification";

describe(templateMilestoneNotification.name, () => {
  it("celebrates the milestone and links to the template's insights", () => {
    const notification = templateMilestoneNotification(
      { id: "user-1", email: "owner@example.com" },
      { templateId: "tpl-1", templateTitle: "Postgres <16>", milestone: 1000, templateUrl: "https://console.test/template/tpl-1" }
    );

    expect(notification).toEqual({
      notificationId: "templateMilestone.tpl-1.1000.user-1",
      payload: {
        summary: '"Postgres <16>" passed 1,000 deploys',
        description:
          "<p>People outside your organization have now deployed <strong>Postgres &lt;16&gt;</strong> 1,000 times on mainnet. Thanks for publishing it.</p>" +
          "<p>Its Insights tab shows how people find it and how long their deployments keep running.</p>",
        actions: [{ label: "See insights", url: "https://console.test/template/tpl-1?tab=insights" }]
      },
      user: { id: "user-1", email: "owner@example.com" }
    });
  });

  it("puts a long or multi-line title on one shortened line in the headline", () => {
    const { payload } = templateMilestoneNotification(
      { id: "user-1", email: null },
      { templateId: "tpl-1", templateTitle: `  ${"a".repeat(60)}\n${"b".repeat(40)}  `, milestone: 10, templateUrl: "https://console.test/template/tpl-1" }
    );

    expect(payload.summary).toBe(`"${"a".repeat(60)} ${"b".repeat(19)}…" passed 10 deploys`);
  });

  it("keeps a title of exactly the headline's length whole", () => {
    const { payload } = templateMilestoneNotification(
      { id: "user-1", email: null },
      { templateId: "tpl-1", templateTitle: "c".repeat(80), milestone: 10, templateUrl: "https://console.test/template/tpl-1" }
    );

    expect(payload.summary).toBe(`"${"c".repeat(80)}" passed 10 deploys`);
  });
});
