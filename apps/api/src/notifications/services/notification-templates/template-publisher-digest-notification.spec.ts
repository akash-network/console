import { describe, expect, it } from "vitest";

import type { DigestEntry } from "@src/template-marketplace/lib/publisher-digest/publisher-digest";
import type { InsightHint } from "@src/template-marketplace/lib/template-insights/template-insight-hints";
import { templatePublisherDigestNotification } from "./template-publisher-digest-notification";

describe(templatePublisherDigestNotification.name, () => {
  it("sums up every template's week, with its change, its top hint and a link to its insights", () => {
    const notification = templatePublisherDigestNotification(
      { id: "user-1", email: "owner@example.com" },
      {
        organizationId: "org-1",
        weekEndsOn: "2026-11-29",
        entries: [
          entry({ templateId: "tpl-1", title: "Postgres <16>", views: 1200, deploys: 12, previousDeploys: 8, stillRunning: 5, hint: hint("few_get_a_provider", 0.4) }),
          entry({ templateId: "tpl-2", title: "Redis", views: 1, deploys: 1, previousDeploys: 0, stillRunning: 0 })
        ],
        templateUrlOf: id => `https://console.test/template/${id}`
      }
    );

    expect(notification).toEqual({
      notificationId: "templatePublisherDigest.org-1.2026-11-29.user-1",
      payload: {
        summary: "Your templates last week: 13 deploys, 1,201 views",
        description:
          "<p>Here is how your public templates did in the week of Nov 23 to Nov 29.</p>" +
          "<p><strong>Postgres &lt;16&gt;</strong><br>1,200 views, 12 deploys (+50% vs the week before), 5 still running after 24 hours<br>" +
          "Only 40% of its deployments got a provider. Asking for fewer resources or raising the price usually helps.<br>" +
          '<a href="https://console.test/template/tpl-1?tab=insights">See its insights</a></p>' +
          "<p><strong>Redis</strong><br>1 view, 1 deploy (none the week before), 0 still running after 24 hours<br>" +
          '<a href="https://console.test/template/tpl-2?tab=insights">See its insights</a></p>' +
          "<p>Numbers count mainnet use by people outside your organization.</p>"
      },
      user: { id: "user-1", email: "owner@example.com" }
    });
  });

  it.each([
    [0, 0, "none the week before either"],
    [4, 4, "same as the week before"],
    [3, 4, "−25% vs the week before"]
  ])("compares %s deploys to %s", (deploys, previousDeploys, change) => {
    const { payload } = templatePublisherDigestNotification(
      { id: "user-1", email: null },
      { organizationId: "org-1", weekEndsOn: "2026-11-29", entries: [entry({ deploys, previousDeploys, views: 1 })], templateUrlOf: id => id }
    );

    expect(payload.description).toContain(`(${change})`);
  });

  it.each<[InsightHint, string]>([
    [hint("few_still_running", 0.3), "Only 30% were still running a day after they got a provider. Check that it starts without extra setup."],
    [hint("latest_version_gets_fewer_providers", 0.5, 0.9, 3), "Version 3 gets a provider 50% of the time, against 90% for the version before it."],
    [hint("latest_version_stops_more", 0.4, 0.8, 2), "40% of version 2's deployments kept running a day, against 80% for the version before it."],
    [hint("latest_version_stops_more", 0.4, null, 2), "40% of version 2's deployments kept running a day, against 0% for the version before it."],
    [hint("latest_version_gets_fewer_providers", 0.5, null, 3), "Version 3 gets a provider 50% of the time, against 0% for the version before it."],
    [hint("few_viewers_deploy", 0.01), "1% of the people who viewed it deployed it. A clearer description may help."],
    [hint("deploys_growing", 12, 4), "Deploys are growing."],
    [hint("running_well", 0.9), "Deployments made from it keep running."]
  ])("words the %o hint", (input, sentence) => {
    const { payload } = templatePublisherDigestNotification(
      { id: "user-1", email: null },
      { organizationId: "org-1", weekEndsOn: "2026-11-29", entries: [entry({ hint: input })], templateUrlOf: id => id }
    );

    expect(payload.description).toContain(`<br>${sentence}<br>`);
  });

  function hint(kind: InsightHint["kind"], value: number, previousValue: number | null = null, version: number | null = null): InsightHint {
    return { kind, tone: "warning", value, previousValue, version };
  }

  function entry(overrides: Partial<DigestEntry> = {}): DigestEntry {
    return { templateId: "tpl-1", title: "Postgres", views: 0, deploys: 0, previousDeploys: 0, stillRunning: 0, hint: undefined, ...overrides };
  }
});
