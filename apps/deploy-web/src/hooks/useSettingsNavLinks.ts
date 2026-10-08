"use client";
import type { ComponentType } from "react";
import { ChartColumnIncreasing, CreditCard, Gift, KeyRound, MessageSquareWarning } from "lucide-react";
import { usePathname } from "next/navigation";

import { useAffiliateProfileQuery } from "@src/queries/useAffiliateProfileQuery";
import { UrlService } from "@src/utils/urlUtils";
import { useFlag } from "./useFlag";

export type SettingsNavLink = {
  title: string;
  url: string;
  isActive: boolean;
  icon: ComponentType<{ className?: string }>;
};

export const DEPENDENCIES = { usePathname, useFlag, useAffiliateProfileQuery };

/** True when the pathname is one of the prefixes or a sub-route of one. */
export const isRouteActive = (pathname: string | null, ...prefixes: string[]) =>
  !!pathname && prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Single source of truth for the settings navigation items, shared by the top-nav Settings dropdown
 * and the settings sidebar so both stay in sync (including active state).
 */
export function useSettingsNavLinks({ dependencies: d }: { dependencies?: Partial<typeof DEPENDENCIES> } = {}): SettingsNavLink[] {
  const merged = { ...DEPENDENCIES, ...d };
  const pathname = merged.usePathname();
  const isAffiliateProgramEnabled = merged.useFlag("affiliate_program");
  const { data: affiliateProfile } = merged.useAffiliateProfileQuery({ enabled: isAffiliateProgramEnabled });

  const links: SettingsNavLink[] = [
    { title: "Billing", url: UrlService.billing(), isActive: isRouteActive(pathname, "/billing"), icon: CreditCard },
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive(pathname, "/user/api-keys"), icon: KeyRound },
    { title: "Usage", url: UrlService.usage(), isActive: isRouteActive(pathname, "/usage"), icon: ChartColumnIncreasing },
    { title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive(pathname, "/alerts"), icon: MessageSquareWarning }
  ];

  if (isAffiliateProgramEnabled && affiliateProfile) {
    links.push({ title: "Referrals", url: UrlService.referrals(), isActive: isRouteActive(pathname, "/referrals"), icon: Gift });
  }

  return links;
}
