import { describe, expect, it } from "vitest";

import type { TemplateInsightHint } from "@src/types/marketplace-template";
import { describeChange, describeHint, formatShare } from "./insightCopy";

describe("insight copy", () => {
  describe(formatShare.name, () => {
    it.each([
      [0, "0%"],
      [0.019, "1.9%"],
      [0.0999, "10.0%"],
      [0.1, "10%"],
      [0.666, "67%"],
      [1, "100%"]
    ])("writes %s as %s", (share, expected) => {
      expect(formatShare(share)).toBe(expected);
    });
  });

  describe(describeHint.name, () => {
    it.each<[TemplateInsightHint, string, string]>([
      [hint({ kind: "few_get_a_provider", value: 0.4 }), "Many deployments don't get a provider", "Only 40% of the deployments in this period got a provider."],
      [hint({ kind: "few_still_running", value: 0.3 }), "Many deployments stop within a day", "Only 30% were still running 24 hours after they got a provider."],
      [
        hint({ kind: "latest_version_gets_fewer_providers", value: 0.5, previousValue: 0.9, version: 3 }),
        "Version 3 gets a provider less often",
        "50% of its deployments got a provider, against 90% for the version before it."
      ],
      [
        hint({ kind: "latest_version_stops_more", value: 0.4, previousValue: 0.8, version: 2 }),
        "Version 2 stops running more often",
        "40% of its deployments were still running after 24 hours, against 80% for the version before it."
      ],
      [hint({ kind: "few_viewers_deploy", value: 0.015 }), "People look but few deploy", "1.5% of the people who viewed it went on to deploy it."],
      [hint({ kind: "deploys_growing", value: 12, previousValue: 4 }), "Deploys are growing", "12 deploys in this period, up from 4 in the period before."],
      [hint({ kind: "deploys_growing", value: 6, previousValue: null }), "Deploys are growing", "6 deploys in this period, up from 0 in the period before."],
      [hint({ kind: "running_well", value: 0.92 }), "Deployments keep running", "92% of deployments were still running 24 hours after they got a provider."]
    ])("words the %o hint", (input, title, body) => {
      const copy = describeHint(input);

      expect(copy.title).toBe(title);
      expect(copy.body).toContain(body);
    });
  });

  describe(describeChange.name, () => {
    it.each([
      [0, 0, "None in the previous 7 days either"],
      [5, 0, "None in the previous 7 days"],
      [5, 5, "Same as the previous 7 days"],
      [6, 4, "+50% vs the previous 7 days"],
      [3, 4, "−25% vs the previous 7 days"]
    ])("compares %s to %s", (current, previous, expected) => {
      expect(describeChange(current, previous, 7)).toBe(expected);
    });
  });

  function hint(overrides: Partial<TemplateInsightHint> & Pick<TemplateInsightHint, "kind" | "value">): TemplateInsightHint {
    return { tone: "warning", previousValue: null, version: null, ...overrides };
  }
});
