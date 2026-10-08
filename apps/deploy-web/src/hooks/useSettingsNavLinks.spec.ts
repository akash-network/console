import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
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

  it("excludes Referrals when the flag is on but the caller has no affiliate profile", () => {
    const { links } = setup({ isAffiliateProgramEnabled: true, affiliateProfile: null });

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
    return { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 } };
  }

  function setup(input: { pathname?: string; isAffiliateProgramEnabled?: boolean; affiliateProfile?: AffiliateProfile | null }) {
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(() => input.isAffiliateProgramEnabled ?? false);
    const useAffiliateProfileQuery = vi.fn<typeof DEPENDENCIES.useAffiliateProfileQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), { data: input.affiliateProfile ?? null })
    );
    const dependencies: Partial<typeof DEPENDENCIES> = {
      usePathname: () => input.pathname ?? "/",
      useFlag,
      useAffiliateProfileQuery
    };

    const links = renderHook(() => useSettingsNavLinks({ dependencies })).result.current;

    return { links, useFlag, useAffiliateProfileQuery };
  }
});
