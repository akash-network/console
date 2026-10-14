import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./useSettingsNavLinks";
import { useSettingsNavLinks } from "./useSettingsNavLinks";

import { renderHook } from "@testing-library/react";

describe(useSettingsNavLinks.name, () => {
  it("includes every settings item", () => {
    const links = setup({});

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  it("marks the item matching the current route as active", () => {
    const links = setup({ pathname: "/usage" });

    expect(links.find(link => link.title === "Usage")?.isActive).toBe(true);
    expect(links.find(link => link.title === "Billing")?.isActive).toBe(false);
  });

  it("marks Billing active on the billing route", () => {
    const links = setup({ pathname: "/billing" });

    expect(links.find(link => link.title === "Billing")?.isActive).toBe(true);
  });

  it.each([
    { pathname: "/billing", active: "Billing" },
    { pathname: "/user/api-keys", active: "API Keys" },
    { pathname: "/usage", active: "Usage" },
    { pathname: "/alerts", active: "Alerts" }
  ])("marks only $active active on $pathname", ({ pathname, active }) => {
    const links = setup({ pathname });

    expect(links.filter(link => link.isActive).map(link => link.title)).toEqual([active]);
  });

  it("treats sub-routes as active", () => {
    const links = setup({ pathname: "/alerts/notification-channels/new" });

    expect(links.find(link => link.title === "Alerts")?.isActive).toBe(true);
  });

  describe("when organizations are enabled", () => {
    it("keeps the personal organization's items as they were", () => {
      const links = setup({ isOrganizationsEnabled: true, organization: { type: "personal", role: "owner" } });

      expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
    });

    it("adds Members first for a team organization", () => {
      const links = setup({ isOrganizationsEnabled: true, organization: { type: "team", role: "owner" }, pathname: "/members" });

      expect(links.map(link => link.title)).toEqual(["Members", "Billing", "API Keys", "Usage", "Alerts"]);
      expect(links[0]).toMatchObject({ url: "/members", isActive: true });
    });

    it.each(["member", "viewer"] as const)("hides Billing and Usage from a %s", role => {
      const links = setup({ isOrganizationsEnabled: true, organization: { type: "team", role } });

      expect(links.map(link => link.title)).toEqual(["Members", "API Keys", "Alerts"]);
    });

    it.each(["admin", "billing"] as const)("keeps Billing and Usage for an %s", role => {
      const links = setup({ isOrganizationsEnabled: true, organization: { type: "team", role } });

      expect(links.map(link => link.title)).toEqual(["Members", "Billing", "API Keys", "Usage", "Alerts"]);
    });

    it("keeps every item until the active organization is known", () => {
      const links = setup({ isOrganizationsEnabled: true });

      expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
    });
  });

  it("ignores the active organization while organizations are disabled", () => {
    const links = setup({ isOrganizationsEnabled: false, organization: { type: "team", role: "member" } });

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  function setup(input: { pathname?: string; isOrganizationsEnabled?: boolean; organization?: Pick<OrganizationOutput, "type" | "role"> }) {
    const dependencies: typeof DEPENDENCIES = {
      usePathname: () => input.pathname ?? "/",
      useFlag: () => input.isOrganizationsEnabled ?? false,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: input.organization ? mock<OrganizationOutput>({ id: "org-1", ...input.organization }) : undefined
        })
    };

    return renderHook(() => useSettingsNavLinks({ dependencies })).result.current;
  }
});
