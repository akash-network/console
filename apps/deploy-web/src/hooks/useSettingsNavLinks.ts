"use client";
import type { ComponentType } from "react";
import { CreditCard, Key, MessageAlert, StatsUpSquare } from "iconoir-react";
import { usePathname } from "next/navigation";

import { UrlService } from "@src/utils/urlUtils";

export type SettingsNavLink = {
  title: string;
  url: string;
  isActive: boolean;
  icon: ComponentType<{ className?: string }>;
};

export const DEPENDENCIES = { usePathname };

/**
 * Single source of truth for the settings navigation items, shared by the top-nav Settings dropdown
 * and the settings sidebar so both stay in sync (including active state).
 */
export function useSettingsNavLinks({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): SettingsNavLink[] {
  const pathname = d.usePathname();

  const isRouteActive = (...prefixes: string[]) => !!pathname && prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return [
    { title: "Billing", url: UrlService.billing(), isActive: isRouteActive("/billing"), icon: CreditCard },
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive("/user/api-keys"), icon: Key },
    { title: "Usage", url: UrlService.usage(), isActive: isRouteActive("/usage"), icon: StatsUpSquare },
    { title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive("/alerts"), icon: MessageAlert }
  ];
}
