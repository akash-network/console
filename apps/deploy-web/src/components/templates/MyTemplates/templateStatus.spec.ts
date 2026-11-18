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
      { label: "Not in gallery", tone: "warning", reason: "It went public before publish checks existed.", nextStep: "share" }
    ],
    [
      "a listed template whose current version is held",
      { visibility: "public", isListed: true, currentVersion: { version: 5, status: "held", createdAt: "2026-11-05T12:00:00.000Z" } },
      { label: "In gallery", tone: "success", versionNote: { label: "v5 held for review", tone: "warning" } }
    ],
    [
      "a private template whose current version failed its checks",
      { visibility: "private", currentVersion: { version: 2, status: "failed_checks", createdAt: "2026-11-05T12:00:00.000Z" } },
      { label: "Not shared", tone: "neutral", versionNote: { label: "v2 failed checks", tone: "danger" } }
    ],
    ["a template without a version", { visibility: "organization", currentVersion: null }, { label: "Shared with organization", tone: "neutral" }]
  ])("describes %s", (_, overrides, expected) => {
    expect(templateStatusOf(buildUserTemplateListItem(overrides))).toEqual(expected);
  });

  it("offers every label as a status filter", () => {
    expect(TEMPLATE_STATUS_LABELS).toEqual(["Not shared", "Shared with organization", "In gallery", "Not in gallery", "Hidden by Akash"]);
  });
});
