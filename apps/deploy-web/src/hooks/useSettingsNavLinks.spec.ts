import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./useSettingsNavLinks";
import { useSettingsNavLinks } from "./useSettingsNavLinks";

import { renderHook } from "@testing-library/react";

describe(useSettingsNavLinks.name, () => {
  it("includes every settings item when the affiliate program is off", () => {
    const { links } = setup({});

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  it("marks the item matching the current route as active", () => {
    const { links } = setup({ pathname: "/usage" });

    expect(links.find(link => link.title === "Usage")?.isActive).toBe(true);
    expect(links.find(link => link.title === "Billing")?.isActive).toBe(false);
  });

  it("marks Billing active on the billing route", () => {
    const { links } = setup({ pathname: "/billing" });

    expect(links.find(link => link.title === "Billing")?.isActive).toBe(true);
  });

  it.each([
    { pathname: "/billing", active: "Billing" },
    { pathname: "/user/api-keys", active: "API Keys" },
    { pathname: "/usage", active: "Usage" },
    { pathname: "/alerts", active: "Alerts" }
  ])("marks only $active active on $pathname", ({ pathname, active }) => {
    const { links } = setup({ pathname });

    expect(links.filter(link => link.isActive).map(link => link.title)).toEqual([active]);
  });

  it("treats sub-routes as active", () => {
    const { links } = setup({ pathname: "/alerts/notification-channels/new" });

    expect(links.find(link => link.title === "Alerts")?.isActive).toBe(true);
  });

  describe("when organizations are enabled", () => {
    it("keeps the personal organization's items as they were", () => {
      const { links } = setup({ isOrganizationsEnabled: true, organization: { type: "personal", role: "owner" } });

      expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
    });

    it("adds General first and Members after it for a team organization", () => {
      const { links } = setup({ isOrganizationsEnabled: true, organization: { type: "team", role: "owner" }, pathname: "/members" });

      expect(links.map(link => link.title)).toEqual(["General", "Members", "Billing", "API Keys", "Usage", "Alerts"]);
      expect(links[0]).toMatchObject({ url: "/organization", isActive: false });
      expect(links[1]).toMatchObject({ url: "/members", isActive: true });
    });

    it("marks General active on the organization settings route", () => {
      const { links } = setup({ isOrganizationsEnabled: true, organization: { type: "team", role: "member" }, pathname: "/organization" });

      expect(links.filter(link => link.isActive).map(link => link.title)).toEqual(["General"]);
    });

    it.each(["member", "viewer"] as const)("hides Billing and Usage from a %s", role => {
      const { links } = setup({ isOrganizationsEnabled: true, organization: { type: "team", role } });

      expect(links.map(link => link.title)).toEqual(["General", "Members", "API Keys", "Alerts"]);
    });

    it.each(["admin", "billing"] as const)("keeps Billing and Usage for an %s", role => {
      const { links } = setup({ isOrganizationsEnabled: true, organization: { type: "team", role } });

      expect(links.map(link => link.title)).toEqual(["General", "Members", "Billing", "API Keys", "Usage", "Alerts"]);
    });

    it("keeps every item until the active organization is known", () => {
      const { links } = setup({ isOrganizationsEnabled: true });

      expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
    });

    it("keeps Referrals for an affiliate whose active team hides billing from them", () => {
      const { links } = setup({
        isOrganizationsEnabled: true,
        organization: { type: "team", role: "member" },
        isAffiliateProgramEnabled: true,
        affiliateProfile: buildAffiliateProfile()
      });

      expect(links.map(link => link.title)).toEqual(["General", "Members", "API Keys", "Alerts", "Referrals"]);
    });
  });

  it("ignores the active organization while organizations are disabled", () => {
    const { links } = setup({ isOrganizationsEnabled: false, organization: { type: "team", role: "member" } });

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  it("excludes Referrals when the flag is on but the caller has no affiliate profile", () => {
    const { links } = setup({ isAffiliateProgramEnabled: true, affiliateProfile: null });

    expect(links.map(link => link.title)).not.toContain("Referrals");
  });

  it("excludes Referrals when the flag is on but the caller is not signed in", () => {
    const { links } = setup({ isAffiliateProgramEnabled: true, isSignedIn: false });

    expect(links.map(link => link.title)).not.toContain("Referrals");
  });

  it("excludes Referrals when the caller has a profile but the flag is off", () => {
    const { links } = setup({ isAffiliateProgramEnabled: false, affiliateProfile: buildAffiliateProfile() });

    expect(links.map(link => link.title)).not.toContain("Referrals");
  });

  it("includes Referrals when the flag is on and the caller has an affiliate profile", () => {
    const { links } = setup({ isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts", "Referrals"]);
  });

  it("marks Referrals active on the referrals route", () => {
    const { links } = setup({ pathname: "/referrals", isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(links.filter(link => link.isActive).map(link => link.title)).toEqual(["Referrals"]);
  });

  it("does not mark Referrals active on an unrelated route", () => {
    const { links } = setup({ pathname: "/billing", isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(links.filter(link => link.isActive).map(link => link.title)).toEqual(["Billing"]);
  });

  it("checks the affiliate_program flag and enables the profile query only when it is on", () => {
    const { useFlag, useAffiliateProfileQuery } = setup({ isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(useFlag).toHaveBeenCalledWith("affiliate_program");
    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("disables the profile query when the flag is off", () => {
    const { useAffiliateProfileQuery } = setup({ isAffiliateProgramEnabled: false });

    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: false });
  });

  function buildAffiliateProfile(): AffiliateProfile {
    return {
      code: "friendcode",
      terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 },
      stats: { signups: 0, payingUsers: 0, totalCommissionUsd: 0, monthCommissionUsd: 0 },
      commissions: []
    };
  }

  function setup(input: {
    pathname?: string;
    isOrganizationsEnabled?: boolean;
    isAffiliateProgramEnabled?: boolean;
    organization?: Pick<OrganizationOutput, "type" | "role">;
    affiliateProfile?: AffiliateProfile | null;
    isSignedIn?: boolean;
  }) {
    const enabledFlags = { organizations: input.isOrganizationsEnabled ?? false, affiliate_program: input.isAffiliateProgramEnabled ?? false };
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(flag => enabledFlags[flag as keyof typeof enabledFlags] ?? false);
    const useAffiliateProfileQuery = vi.fn<typeof DEPENDENCIES.useAffiliateProfileQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), {
        data: input.isSignedIn === false ? undefined : (input.affiliateProfile ?? null)
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      usePathname: () => input.pathname ?? "/",
      useFlag,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: input.organization ? mock<OrganizationOutput>({ id: "org-1", ...input.organization }) : undefined
        }),
      useAffiliateProfileQuery
    };

    const links = renderHook(() => useSettingsNavLinks({ dependencies })).result.current;

    return { links, useFlag, useAffiliateProfileQuery };
  }
});
