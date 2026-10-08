import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import type { DEPENDENCIES } from "./useSettingsNavLinks";
import { useSettingsNavLinks } from "./useSettingsNavLinks";

import { renderHook } from "@testing-library/react";

describe(useSettingsNavLinks.name, () => {
  it("includes every settings item when the affiliate program is off", () => {
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

  it("excludes Referrals when the flag is on but the caller has no affiliate profile", () => {
    const links = setup({ isAffiliateProgramEnabled: true, affiliateProfile: null });

    expect(links.map(link => link.title)).not.toContain("Referrals");
  });

  it("excludes Referrals when the caller has a profile but the flag is off", () => {
    const links = setup({ isAffiliateProgramEnabled: false, affiliateProfile: buildAffiliateProfile() });

    expect(links.map(link => link.title)).not.toContain("Referrals");
  });

  it("includes Referrals when the flag is on and the caller has an affiliate profile", () => {
    const links = setup({ isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts", "Referrals"]);
  });

  it("marks Referrals active on the referrals route", () => {
    const links = setup({ pathname: "/referrals", isAffiliateProgramEnabled: true, affiliateProfile: buildAffiliateProfile() });

    expect(links.filter(link => link.isActive).map(link => link.title)).toEqual(["Referrals"]);
  });

  function buildAffiliateProfile(): AffiliateProfile {
    return { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 } };
  }

  function setup(input: { pathname?: string; isAffiliateProgramEnabled?: boolean; affiliateProfile?: AffiliateProfile | null }) {
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isAffiliateProgramEnabled ?? false;
    const useAffiliateProfileQuery: typeof DEPENDENCIES.useAffiliateProfileQuery = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), { data: input.affiliateProfile ?? null });
    const dependencies: Partial<typeof DEPENDENCIES> = {
      usePathname: () => input.pathname ?? "/",
      useFlag,
      useAffiliateProfileQuery
    };

    return renderHook(() => useSettingsNavLinks({ dependencies })).result.current;
  }
});
