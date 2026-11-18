import { describe, expect, it } from "vitest";

import type { TemplatePublishCheck } from "@src/types/marketplace-template";
import type { PublishOrganization } from "./publishReadiness";
import {
  countPublishBlockers,
  describePublishRequirement,
  failedPublishChecksOf,
  publishCheckFixesOf,
  publishCheckLabelOf,
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
    ["text_within_limits", "Text within limits"]
  ])("names the %s check", (key, expected) => {
    expect(publishCheckLabelOf(key)).toBe(expected);
  });

  it("makes a readable name for a check this build does not know", () => {
    expect(publishCheckLabelOf("ports_reviewed")).toBe("Ports reviewed");
  });
});

describe(publishCheckFixesOf.name, () => {
  it.each(["sdl_valid", "no_secrets", "images_allowed", "fixed_tags"] as const)("sends a failed %s check to Edit configuration", key => {
    expect(publishCheckFixesOf(buildCheck({ key, status: "failed", issues: [{ message: "Wrong" }] }))).toEqual(["edit-configuration"]);
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
    const unknownCheck = { ...buildCheck({ status: "failed", issues: [{ message: "Too long", field: "title" }] }), key: "text_within_limits" };

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
