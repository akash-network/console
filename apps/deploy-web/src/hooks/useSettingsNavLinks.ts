"use client";
import type { ComponentType } from "react";
import { CreditCard, Key, MessageAlert, StatsUpSquare } from "iconoir-react";
import { usePathname } from "next/navigation";

import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";

export type SettingsNavLink = {
  title: string;
  url: string;
  isActive: boolean;
  icon: ComponentType<{ className?: string }>;
};

export const DEPENDENCIES = { useFlag, usePathname };

/**
 * Single source of truth for the settings navigation items, shared by the top-nav Settings dropdown
 * and the settings sidebar so both stay in sync (including feature-flag gating and active state).
 */
export function useSettingsNavLinks({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): SettingsNavLink[] {
  const isBillingUsageEnabled = d.useFlag("billing_usage");
  const isAlertsEnabled = d.useFlag("alerts");
  const pathname = d.usePathname();

  const isRouteActive = (...prefixes: string[]) => !!pathname && prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return [
    ...(isBillingUsageEnabled ? [{ title: "Billing", url: UrlService.billing(), isActive: isRouteActive("/billing"), icon: CreditCard }] : []),
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive("/user/api-keys"), icon: Key },
    ...(isBillingUsageEnabled ? [{ title: "Usage", url: UrlService.usage(), isActive: isRouteActive("/usage"), icon: StatsUpSquare }] : []),
    ...(isAlertsEnabled ? [{ title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive("/alerts"), icon: MessageAlert }] : [])
  ];
}
