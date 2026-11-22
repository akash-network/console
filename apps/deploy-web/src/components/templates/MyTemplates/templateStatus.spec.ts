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
    [
      "an unlisted public template that went through the publish checks",
      { visibility: "public", isListed: false, publishedAt: "2026-11-02T10:00:00.000Z" },
      { label: "Not in gallery", tone: "warning", reason: "It was taken out of the gallery.", nextStep: "share" }
    ],
    [
      "a listed template whose newest version is held while an older one stays current",
      {
        visibility: "public",
        isListed: true,
        currentVersion: { version: 4, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
        latestVersion: { version: 5, status: "held" }
      },
      { label: "In gallery", tone: "success", versionNote: { label: "v5 held for review", tone: "warning" } }
    ],
    [
      "a template whose newest version failed its checks",
      {
        visibility: "public",
        isListed: true,
        currentVersion: { version: 1, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
        latestVersion: { version: 2, status: "failed_checks" }
      },
      { label: "In gallery", tone: "success", versionNote: { label: "v2 failed checks", tone: "danger" } }
    ],
    [
      "a template whose newest version staff rejected",
      {
        visibility: "organization",
        currentVersion: { version: 2, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
        latestVersion: { version: 3, status: "rejected" }
      },
      { label: "Shared with organization", tone: "neutral", versionNote: { label: "v3 rejected by staff", tone: "danger" } }
    ],
    [
      "a template whose newest version is the live one",
      {
        visibility: "private",
        currentVersion: { version: 2, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
        latestVersion: { version: 2, status: "live" }
      },
      { label: "Not shared", tone: "neutral" }
    ],
    [
      "a template whose held version was followed by a live one",
      {
        visibility: "private",
        currentVersion: { version: 3, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
        latestVersion: { version: 3, status: "live" }
      },
      { label: "Not shared", tone: "neutral" }
    ],
    ["a template without a version", { visibility: "organization", currentVersion: null }, { label: "Shared with organization", tone: "neutral" }]
  ])("describes %s", (_, overrides, expected) => {
    expect(templateStatusOf(buildUserTemplateListItem(overrides))).toEqual(expected);
  });

  it("offers every label as a status filter", () => {
    expect(TEMPLATE_STATUS_LABELS).toEqual(["Not shared", "Shared with organization", "In gallery", "Not in gallery", "Hidden by Akash"]);
  });
});
