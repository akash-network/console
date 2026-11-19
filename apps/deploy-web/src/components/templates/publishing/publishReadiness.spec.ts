import { describe, expect, it } from "vitest";

import type { TemplatePublishCheck } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";
import type { PublishOrganization } from "./publishReadiness";
import {
  countPublishBlockers,
  describePublishRequirement,
  failedPublishChecksOf,
  PUBLISH_CHECK_FIX_LABELS,
  publishCheckFixesOf,
  publishCheckLabelOf,
  publishFixLinksOf,
  readableKeyOf
} from "./publishReadiness";

const TEAM: PublishOrganization = { name: "Northwind Labs", type: "team" };
const PERSONAL: PublishOrganization = { name: "sam.rivera", type: "personal" };

describe(readableKeyOf.name, () => {
  it.each([
    ["text_within_limits", "Text within limits"],
    ["images__scanned_", "Images scanned"],
    ["x", "X"],
    ["", ""]
  ])("turns %j into %j", (key, expected) => {
    expect(readableKeyOf(key)).toBe(expected);
  });
});

describe(publishCheckLabelOf.name, () => {
  it.each([
    ["sdl_valid", "SDL is valid"],
    ["no_secrets", "No secrets in values"],
    ["images_allowed", "Images allowed"],
    ["fixed_tags", "Images use a fixed tag"],
    ["name_not_reserved", "Name not reserved"],
    ["text_within_limits", "Title, summary and README within their length limits"]
  ])("names the %s check", (key, expected) => {
    expect(publishCheckLabelOf(key)).toBe(expected);
  });

  it("makes a readable name for a check this build does not know", () => {
    expect(publishCheckLabelOf("ports_reviewed")).toBe("Ports reviewed");
  });
});

describe(publishFixLinksOf.name, () => {
  it("points every fix of a team's template at the place it is made", () => {
    expect(publishFixLinksOf({ id: "tpl-9", currentVersion: { version: 4 } }, TEAM)).toEqual({
      rename: "/template/tpl-9?tab=settings",
      "rename-organization": "/organization",
      "edit-configuration": UrlService.configureTemplate({ mode: "edit", userTemplateId: "tpl-9", baseVersion: 4 }),
      "edit-readme": "/template/tpl-9?tab=readme",
      "edit-summary": "/template/tpl-9?tab=settings"
    });
  });

  it.each([
    ["a personal account", PERSONAL],
    ["no organization", null]
  ])("offers no organization settings for %s", (_, organization) => {
    expect(publishFixLinksOf({ id: "tpl-9", currentVersion: { version: 4 } }, organization)["rename-organization"]).toBeUndefined();
  });

  it("edits a template without a version from no base version", () => {
    expect(publishFixLinksOf({ id: "tpl-9", currentVersion: null }, TEAM)["edit-configuration"]).toBe(
      UrlService.configureTemplate({ mode: "edit", userTemplateId: "tpl-9" })
    );
  });
});

describe("PUBLISH_CHECK_FIX_LABELS", () => {
  it("names every fix", () => {
    expect(PUBLISH_CHECK_FIX_LABELS).toEqual({
      rename: "Rename",
      "rename-organization": "Organization settings",
      "edit-configuration": "Edit configuration",
      "edit-readme": "Edit README",
      "edit-summary": "Settings"
    });
  });
});

describe(publishCheckFixesOf.name, () => {
  it.each([
    ["title", "rename"],
    ["summary", "edit-summary"],
    ["readme", "edit-readme"]
  ] as const)("sends a %s over its limit to %s", (field, fix) => {
    expect(publishCheckFixesOf(buildCheck({ key: "text_within_limits", status: "failed", issues: [{ message: "Too long", field }] }))).toEqual([fix]);
  });

  it("offers one fix per field over its limit, title first", () => {
    const check = buildCheck({
      key: "text_within_limits",
      status: "failed",
      issues: [
        { message: "The README is too long", field: "readme" },
        { message: "The summary is too long", field: "summary" },
        { message: "The title is too long", field: "title" },
        { message: "The README is still too long", field: "readme" }
      ]
    });

    expect(publishCheckFixesOf(check)).toEqual(["rename", "edit-summary", "edit-readme"]);
  });

  it.each([
    ["names no field", [{ message: "Too long" }]],
    ["names a field with no place to fix it", [{ message: "Too long", field: "publisher_name" as const }]],
    ["has no reason", []]
  ])("offers no fix for a text limit that %s", (_, issues) => {
    expect(publishCheckFixesOf(buildCheck({ key: "text_within_limits", status: "failed", issues }))).toEqual([]);
  });

  it("offers no fix for text limits that passed", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "text_within_limits", status: "passed", issues: [{ message: "Fine", field: "title" }] }))).toEqual([]);
  });

  it.each(["sdl_valid", "no_secrets", "images_allowed", "fixed_tags"] as const)("sends a failed %s check to Edit configuration", key => {
    expect(publishCheckFixesOf(buildCheck({ key, status: "failed", issues: [{ message: "Wrong" }] }))).toEqual(["edit-configuration"]);
  });

  it("sends a failed check without a reason to Edit configuration", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "sdl_valid", status: "failed", issues: [] }))).toEqual(["edit-configuration"]);
  });

  it("sends a credential found in the README to the README", () => {
    expect(
      publishCheckFixesOf(buildCheck({ key: "no_secrets", status: "failed", issues: [{ message: "The README holds an API key.", field: "readme" }] }))
    ).toEqual(["edit-readme"]);
  });

  it("offers both when credentials sit in the configuration and in the README", () => {
    expect(
      publishCheckFixesOf(
        buildCheck({
          key: "no_secrets",
          status: "failed",
          issues: [
            { message: "The README holds an API key.", field: "readme" },
            { message: "The SDL holds a token.", field: "sdl" },
            { message: "web: HF_TOKEN looks like a key.", service: "web", variable: "HF_TOKEN" }
          ]
        })
      )
    ).toEqual(["edit-configuration", "edit-readme"]);
  });

  it("offers nothing on a check that passed", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "fixed_tags", status: "passed" }))).toEqual([]);
    expect(publishCheckFixesOf(buildCheck({ key: "name_not_reserved", status: "passed", issues: [{ message: "Old", field: "title" }] }))).toEqual([]);
  });

  it("offers a rename for a reserved word in the title", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "name_not_reserved", status: "failed", issues: [{ message: "Reserved", field: "title" }] }))).toEqual([
      "rename"
    ]);
  });

  it("offers a rename when the issue names no field", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "name_not_reserved", status: "failed", issues: [{ message: "Reserved" }] }))).toEqual(["rename"]);
  });

  it("points at the organization for a reserved word in the publisher name", () => {
    expect(publishCheckFixesOf(buildCheck({ key: "name_not_reserved", status: "failed", issues: [{ message: "Reserved", field: "publisher_name" }] }))).toEqual(
      ["rename-organization"]
    );
  });

  it("offers both when the title and the publisher name are reserved", () => {
    expect(
      publishCheckFixesOf(
        buildCheck({
          key: "name_not_reserved",
          status: "failed",
          issues: [
            { message: "Reserved", field: "publisher_name" },
            { message: "Reserved", field: "title" }
          ]
        })
      )
    ).toEqual(["rename", "rename-organization"]);
  });

  it("offers nothing for a failed check this build does not know", () => {
    const unknownCheck = { ...buildCheck({ status: "failed", issues: [{ message: "Too long", field: "title" }] }), key: "ports_reviewed" };

    expect(publishCheckFixesOf(unknownCheck as TemplatePublishCheck)).toEqual([]);
  });
});

describe(failedPublishChecksOf.name, () => {
  it("keeps only the failed checks, in their order", () => {
    const failedTags = buildCheck({ key: "fixed_tags", status: "failed" });
    const failedName = buildCheck({ key: "name_not_reserved", status: "failed" });

    expect(failedPublishChecksOf([buildCheck({ key: "sdl_valid" }), failedTags, buildCheck({ key: "no_secrets" }), failedName])).toEqual([
      failedTags,
      failedName
    ]);
  });
});

describe(countPublishBlockers.name, () => {
  it("counts every unmet requirement and every failed check", () => {
    expect(
      countPublishBlockers({
        requirements: [
          { key: "email_verified", met: true },
          { key: "organization_payment", met: false },
          { key: "publisher_role", met: false }
        ],
        checks: [buildCheck({ key: "sdl_valid" }), buildCheck({ key: "fixed_tags", status: "failed" })]
      })
    ).toBe(3);
  });

  it("counts nothing when everything is met", () => {
    expect(countPublishBlockers({ requirements: [{ key: "email_verified", met: true }], checks: [buildCheck({})] })).toBe(0);
  });
});

describe(describePublishRequirement.name, () => {
  it("offers the email verification", () => {
    expect(describePublishRequirement({ key: "email_verified", met: false }, TEAM)).toEqual({
      label: "Email verified",
      help: "Public templates come from people with a verified email.",
      fix: "verify-email"
    });
  });

  it("asks a team organization for a payment", () => {
    expect(describePublishRequirement({ key: "organization_payment", met: false }, TEAM)).toEqual({
      label: "Organization has a successful payment",
      help: "Public templates need at least one completed payment on Northwind Labs. Trial credits don't count.",
      fix: "add-credits"
    });
  });

  it.each([
    ["a personal organization", PERSONAL],
    ["an unknown organization", null]
  ])("asks %s for a payment on the account", (_, organization) => {
    expect(describePublishRequirement({ key: "organization_payment", met: false }, organization)).toEqual({
      label: "Account has a successful payment",
      help: "Public templates need at least one completed payment on your account. Trial credits don't count.",
      fix: "add-credits"
    });
  });

  it("names who can publish for a team", () => {
    expect(describePublishRequirement({ key: "publisher_role", met: false }, TEAM)).toEqual({
      label: "Owner or admin of Northwind Labs",
      help: "Public templates are published under the name Northwind Labs, so only its owners and admins can make one public. Ask an owner or admin of Northwind Labs."
    });
  });

  it("keeps the publisher role about the account for a personal organization", () => {
    expect(describePublishRequirement({ key: "publisher_role", met: true }, PERSONAL)).toEqual({
      label: "Your own account",
      help: "Only the owner of this account can make its templates public."
    });
    expect(describePublishRequirement({ key: "publisher_role", met: true }, null).label).toBe("Your own account");
  });

  it("sends a suspended team publisher to support", () => {
    expect(describePublishRequirement({ key: "publisher_in_good_standing", met: false }, TEAM)).toEqual({
      label: "Publisher in good standing",
      help: "Akash paused publishing for Northwind Labs. Contact support to find out why.",
      fix: "contact-support"
    });
  });

  it("sends a suspended personal publisher to support", () => {
    expect(describePublishRequirement({ key: "publisher_in_good_standing", met: false }, PERSONAL).help).toBe(
      "Akash paused publishing for your account. Contact support to find out why."
    );
  });

  it("describes a requirement this build does not know", () => {
    expect(describePublishRequirement({ key: "two_factor_enabled", met: false }, TEAM)).toEqual({
      label: "Two factor enabled",
      help: "This requirement isn't met yet."
    });
  });
});

function buildCheck(overrides: Partial<TemplatePublishCheck>): TemplatePublishCheck {
  return { key: "sdl_valid", status: "passed", issues: [], ...overrides };
}
