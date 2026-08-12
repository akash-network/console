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

/** True when the pathname is one of the prefixes or a sub-route of one. */
export const isRouteActive = (pathname: string | null, ...prefixes: string[]) =>
  !!pathname && prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Single source of truth for the settings navigation items, shared by the top-nav Settings dropdown
 * and the settings sidebar so both stay in sync (including active state).
 */
export function useSettingsNavLinks({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): SettingsNavLink[] {
  const pathname = d.usePathname();

  return [
    { title: "Billing", url: UrlService.billing(), isActive: isRouteActive(pathname, "/billing"), icon: CreditCard },
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive(pathname, "/user/api-keys"), icon: Key },
    { title: "Usage", url: UrlService.usage(), isActive: isRouteActive(pathname, "/usage"), icon: StatsUpSquare },
    { title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive(pathname, "/alerts"), icon: MessageAlert }
  ];
}
