"use client";
import { useRef, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@akashnetwork/ui/components";
import { cn, REMOVE_SCROLL_CLASS_NAMES } from "@akashnetwork/ui/utils";
import { Menu, NavArrowDown } from "iconoir-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useFlag } from "@src/hooks/useFlag";
import useCookieTheme from "@src/hooks/useTheme";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";
import { AkashLogo } from "../AkashLogo";
import { HackathonCouponNavEntry } from "../HackathonCouponNavEntry/HackathonCouponNavEntry";
import { TopBanner } from "../TopBanner";
import { usePublishHeaderHeight } from "../usePublishHeaderHeight";
import { TopNavAccountMenu } from "./TopNavAccountMenu";

export const DEPENDENCIES = { useUser, useFlag, usePathname, useCookieTheme, TopBanner, HackathonCouponNavEntry, TopNavAccountMenu };

interface Props {
  dependencies?: typeof DEPENDENCIES;
  /** During onboarding, reduce the chrome to the logo and a logout-only account menu. */
  minimal?: boolean;
}

type TopNavLink = {
  title: string;
  url: string;
  isActive: boolean;
};

export function TopNav({ dependencies: d = DEPENDENCIES, minimal = false }: Props = {}) {
  const theme = d.useCookieTheme();
  const headerRef = useRef<HTMLElement>(null);
  usePublishHeaderHeight(headerRef);
  const { user } = d.useUser();
  const isAuthenticated = !!user?.userId;
  const pathname = d.usePathname();
  const isBillingUsageEnabled = d.useFlag("billing_usage");
  const isAlertsEnabled = d.useFlag("alerts");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const isRouteActive = (...routePrefixes: string[]) => !!pathname && routePrefixes.some(prefix => pathname.startsWith(prefix));

  const navLinks: TopNavLink[] = [
    { title: "Deployments", url: UrlService.deploymentList(), isActive: isRouteActive("/deployments", "/new-deployment") },
    { title: "Providers", url: UrlService.providers(), isActive: isRouteActive("/providers") },
    { title: "Templates", url: UrlService.templates(), isActive: isRouteActive("/templates") }
  ];

  const settingsLinks: TopNavLink[] = [
    ...(isBillingUsageEnabled ? [{ title: "Billing", url: UrlService.billing(), isActive: isRouteActive("/billing") }] : []),
    { title: "API Keys", url: UrlService.userApiKeys(), isActive: isRouteActive("/user/api-keys") },
    ...(isBillingUsageEnabled ? [{ title: "Usage", url: UrlService.usage(), isActive: isRouteActive("/usage") }] : []),
    ...(isAlertsEnabled ? [{ title: "Alerts", url: UrlService.alerts(), isActive: isRouteActive("/alerts") }] : [])
  ];
  const isSettingsActive = settingsLinks.some(link => link.isActive);
  const showNavLinks = isAuthenticated && !minimal;

  return (
    <header ref={headerRef} className={cn("fixed left-0 right-0 top-0 z-50 border-b border-border bg-header", REMOVE_SCROLL_CLASS_NAMES.zeroRight)}>
      <d.TopBanner />

      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        <div className="flex items-center gap-8">
          {!!theme && (
            <Link className="flex items-center" href="/">
              <AkashLogo />
            </Link>
          )}

          {showNavLinks && (
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {navLinks.map(link => (
                <Link key={link.title} href={link.url} aria-current={link.isActive ? "page" : undefined} className={desktopNavLinkClasses(link.isActive)}>
                  {link.title}
                </Link>
              ))}

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className={cn(desktopNavLinkClasses(isSettingsActive), "flex items-center gap-1")}>
                  Settings
                  <NavArrowDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[160px]">
                  {settingsLinks.map(link => (
                    <DropdownMenuItem key={link.title} asChild className="cursor-pointer">
                      <Link href={link.url}>{link.title}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!minimal && (
            <div className="hidden md:block">
              <d.HackathonCouponNavEntry />
            </div>
          )}

          <d.TopNavAccountMenu minimal={minimal} />

          {showNavLinks && (
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full md:hidden" aria-label="Open navigation menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetTitle>
                  <AkashLogo />
                </SheetTitle>
                <nav aria-label="Primary mobile" className="mt-6 flex flex-col gap-1">
                  {navLinks.map(link => (
                    <Link
                      key={link.title}
                      href={link.url}
                      aria-current={link.isActive ? "page" : undefined}
                      className={mobileNavLinkClasses(link.isActive)}
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      {link.title}
                    </Link>
                  ))}

                  <Separator className="my-2" />

                  <div className="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">Settings</div>
                  {settingsLinks.map(link => (
                    <Link
                      key={link.title}
                      href={link.url}
                      aria-current={link.isActive ? "page" : undefined}
                      className={mobileNavLinkClasses(link.isActive)}
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      {link.title}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

function desktopNavLinkClasses(isActive: boolean) {
  return cn("rounded-md px-3 py-2 text-sm transition-colors hover:text-foreground", {
    "font-medium text-foreground": isActive,
    "text-muted-foreground": !isActive
  });
}

function mobileNavLinkClasses(isActive: boolean) {
  return cn("rounded-md px-3 py-2 text-sm hover:bg-accent", {
    "bg-accent font-medium text-foreground": isActive,
    "text-muted-foreground": !isActive
  });
}
