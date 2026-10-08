"use client";
import type { ComponentType } from "react";
import { ChartColumnIncreasing, CreditCard, Gift, KeyRound, MessageSquareWarning, Settings, Users } from "lucide-react";
import { usePathname } from "next/navigation";

import { canViewBillingAndUsage, hasGeneralSettingsPage, hasMembersPage } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useAffiliateProfileQuery } from "@src/queries/useAffiliateProfileQuery";
import { isRouteActive } from "@src/utils/isRouteActive";
import { UrlService } from "@src/utils/urlUtils";

export type SettingsNavLink = {
  title: string;
  url: string;
  isActive: boolean;
  icon: ComponentType<{ className?: string }>;
};

export const DEPENDENCIES = { usePathname, useFlag, useActiveOrganization, useAffiliateProfileQuery };

/**
 * Single source of truth for the settings navigation items, shared by the top-nav Settings dropdown
 * and the settings sidebar so both stay in sync (including active state).
 */
export function useSettingsNavLinks({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): SettingsNavLink[] {
  const pathname = d.usePathname();
  const isOrganizationsEnabled = d.useFlag("organizations");
  const isAffiliateProgramEnabled = d.useFlag("affiliate_program");
  const { activeOrganization } = d.useActiveOrganization();
  const { data: affiliateProfile } = d.useAffiliateProfileQuery({ enabled: isAffiliateProgramEnabled });
  const organization = isOrganizationsEnabled ? activeOrganization : undefined;
  const showsGeneral = !!organization && hasGeneralSettingsPage(organization.type);
  const showsMembers = !!organization && hasMembersPage(organization.type);
  const showsBillingAndUsage = !organization || canViewBillingAndUsage(organization.role);
  const showsReferrals = isAffiliateProgramEnabled && !!affiliateProfile;

  return [
    ...(showsGeneral ? [{ title: "General", url: UrlService.organizationSettings(), isActive: isRouteActive(pathname, "/organization"), icon: Settings }] : []),
    ...(showsMembers ? [{ title: "Members", url: UrlService.members(), isActive: isRouteActive(pathname, "/members"), icon: Users }] : []),
    ...(showsBillingAndUsage ? [{ title: "Billing", url: UrlService.billing(), isActive: isRouteActive(pathname, "/billing"), icon: CreditCard }] : []),
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive(pathname, "/user/api-keys"), icon: KeyRound },
    ...(showsBillingAndUsage ? [{ title: "Usage", url: UrlService.usage(), isActive: isRouteActive(pathname, "/usage"), icon: ChartColumnIncreasing }] : []),
    { title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive(pathname, "/alerts"), icon: MessageSquareWarning },
    ...(showsReferrals ? [{ title: "Referrals", url: UrlService.referrals(), isActive: isRouteActive(pathname, "/referrals"), icon: Gift }] : [])
  ];
}
