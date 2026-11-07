import { describe, expect, it } from "vitest";

import type { UserTemplateListItem } from "@src/types/marketplace-template";
import { TEMPLATE_STATUS_LABELS, templateStatusOf } from "./templateStatus";

import { buildUserTemplateListItem } from "@tests/seeders/userTemplate";

describe(templateStatusOf.name, () => {
  it.each<[string, Partial<UserTemplateListItem>, ReturnType<typeof templateStatusOf>]>([
    [
      "a hidden public template",
      { visibility: "public", isListed: true, moderationStatus: "hidden" },
      { label: "Hidden by Akash", tone: "danger", reason: "Akash hid this template.", nextStep: "contact-support" }
    ],
    [
      "a hidden private template",
      { visibility: "private", moderationStatus: "hidden" },
      { label: "Hidden by Akash", tone: "danger", reason: "Akash hid this template.", nextStep: "contact-support" }
    ],
    ["a private template", { visibility: "private" }, { label: "Not shared", tone: "neutral" }],
    ["an organization template", { visibility: "organization" }, { label: "Shared with organization", tone: "neutral" }],
    ["a listed public template", { visibility: "public", isListed: true }, { label: "In gallery", tone: "success" }],
    [
      "an unlisted public template",
      { visibility: "public", isListed: false },
      { label: "Not in gallery", tone: "warning", reason: "Saved before checks existed." }
    ]
  ])("describes %s", (_, overrides, expected) => {
    expect(templateStatusOf(buildUserTemplateListItem(overrides))).toEqual(expected);
  });

  it("offers every label as a status filter", () => {
    expect(TEMPLATE_STATUS_LABELS).toEqual(["Not shared", "Shared with organization", "In gallery", "Not in gallery", "Hidden by Akash"]);
  });
});
