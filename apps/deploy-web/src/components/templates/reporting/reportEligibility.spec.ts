import { describe, expect, it } from "vitest";

import type { ReportViewer } from "./reportEligibility";
import { canReportTemplate } from "./reportEligibility";

import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

const VISITOR: ReportViewer = { username: "casey", organizations: [{ type: "personal", slug: null }] };

describe(canReportTemplate.name, () => {
  it("lets someone outside the publishing organization report a public template", () => {
    expect(canReportTemplate(buildTemplate({}), VISITOR)).toBe(true);
  });

  it.each(["private", "organization"] as const)("offers no report on a template shared as %s", visibility => {
    expect(canReportTemplate(buildTemplate({ visibility }), VISITOR)).toBe(false);
  });

  it.each(["hidden", "removed"] as const)("offers no report on a %s template", moderationStatus => {
    expect(canReportTemplate(buildTemplate({ moderationStatus }), VISITOR)).toBe(false);
  });

  it("offers no report to someone who can edit the template", () => {
    expect(canReportTemplate(buildTemplate({ canEdit: true }), VISITOR)).toBe(false);
  });

  it("offers no report to a member of the publishing team, whichever organization is active", () => {
    const viewer: ReportViewer = {
      username: "casey",
      organizations: [
        { type: "personal", slug: null },
        { type: "team", slug: "northwind-labs" }
      ]
    };

    expect(canReportTemplate(buildTemplate({}), viewer)).toBe(false);
  });

  it("lets a member of another team report it", () => {
    const viewer: ReportViewer = { username: "casey", organizations: [{ type: "team", slug: "lambda-garage" }] };

    expect(canReportTemplate(buildTemplate({}), viewer)).toBe(true);
  });

  it("never matches a team by a missing slug", () => {
    const template = buildTemplate({ publisher: { name: "Northwind Labs", slug: null, type: "team", handle: null } });
    const viewer: ReportViewer = { username: "casey", organizations: [{ type: "team", slug: null }] };

    expect(canReportTemplate(template, viewer)).toBe(true);
  });

  it("does not take a personal organization for the publishing team", () => {
    const viewer: ReportViewer = { username: "casey", organizations: [{ type: "personal", slug: "northwind-labs" }] };

    expect(canReportTemplate(buildTemplate({}), viewer)).toBe(true);
  });

  it("offers no report to the owner of the personal account that published it", () => {
    const template = buildTemplate({ publisher: { name: "casey", slug: null, type: "personal", handle: "casey" }, author: { username: "casey" } });

    expect(canReportTemplate(template, VISITOR)).toBe(false);
  });

  it("lets someone else report a template published from a personal account", () => {
    const template = buildTemplate({ publisher: { name: "sam", slug: null, type: "personal", handle: "sam" }, author: { username: "sam" } });

    expect(canReportTemplate(template, VISITOR)).toBe(true);
    expect(canReportTemplate(template, { username: undefined, organizations: [] })).toBe(true);
  });

  it("lets a viewer without a username report a template whose author is gone", () => {
    const template = buildTemplate({ publisher: { name: "sam", slug: null, type: "personal", handle: "sam" }, author: null });

    expect(canReportTemplate(template, { username: undefined, organizations: [] })).toBe(true);
  });

  function buildTemplate(overrides: Parameters<typeof buildMarketplaceTemplate>[0]) {
    return buildMarketplaceTemplate({
      visibility: "public",
      isListed: true,
      canEdit: false,
      publisher: { name: "Northwind Labs", slug: "northwind-labs", type: "team", handle: "northwind-labs" },
      author: { username: "sam" },
      ...overrides
    });
  }
});
