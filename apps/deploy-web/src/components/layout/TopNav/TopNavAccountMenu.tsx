"use client";
import React from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Book, CloudSunny, LogOut, Page, Send, ShieldCheck, User } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { CustomDropdownLinkItem } from "../../shared/CustomDropdownLinkItem";
import { ThemeToggle } from "./ThemeToggle";

export const DEPENDENCIES = { useCustomUser, useRouter, ThemeToggle };

interface Props {
  dependencies?: typeof DEPENDENCIES;
  /** During onboarding, reduce the signed-in menu to the Log out action only. */
  minimal?: boolean;
  /** "dropdown" renders the avatar trigger + popover; "inline" renders a flat list for the mobile nav sheet. */
  variant?: "dropdown" | "inline";
  /** Called after an inline item is selected so the surrounding sheet can close. */
  onNavigate?: () => void;
}

type AccountAction = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  onClick: () => void;
};

const DOCS_URL = "https://akash.network/docs";

export function TopNavAccountMenu({ dependencies: d = DEPENDENCIES, minimal = false, variant = "dropdown", onNavigate }: Props = {}) {
  const { user, isLoading } = d.useCustomUser();
  const username = user?.username;
  const router = d.useRouter();
  const { authService, urlService } = useServices();

  const links: AccountAction[] = [
    { title: "Profile", icon: User, onClick: () => router.push(urlService.userSettings()) },
    { title: "Docs", icon: Book, onClick: () => window.open(DOCS_URL, "_blank", "noreferrer noopener") },
    { title: "Privacy Policy", icon: ShieldCheck, onClick: () => router.push(urlService.privacyPolicy()) },
    { title: "Terms of Service", icon: Page, onClick: () => router.push(urlService.termsOfService()) },
    { title: "Contact us", icon: Send, iconClassName: "-rotate-45", onClick: () => router.push(urlService.contact()) }
  ];
  const [profileLink, ...secondaryLinks] = links;

  if (variant === "inline") {
    if (!user) return null;

    const handle = (action: AccountAction) => () => {
      action.onClick();
      onNavigate?.();
    };

    return (
      <div className="flex flex-col gap-1">
        <button type="button" className={inlineItemClasses()} onClick={handle(profileLink)}>
          <profileLink.icon className="h-5 w-5 shrink-0" />
          {profileLink.title}
        </button>

        <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-3">
            <CloudSunny className="h-5 w-5 shrink-0" />
            Theme
          </span>
          <d.ThemeToggle />
        </div>

        {secondaryLinks.map(link => (
          <button type="button" key={link.title} className={inlineItemClasses()} onClick={handle(link)}>
            <link.icon className={cn("h-5 w-5 shrink-0", link.iconClassName)} />
            {link.title}
          </button>
        ))}

        <button
          type="button"
          className={inlineItemClasses("text-destructive hover:text-destructive")}
          onClick={() => {
            authService.logout();
            onNavigate?.();
          }}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Log out
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-2">
        <Spinner size="small" />
      </div>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9 cursor-pointer rounded-full bg-accent" aria-label="Account menu">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-transparent">{username ? username[0].toUpperCase() : <User />}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        {user ? (
          <div className="w-full">
            {!minimal && (
              <>
                <CustomDropdownLinkItem onClick={profileLink.onClick} icon={<profileLink.icon />}>
                  {profileLink.title}
                </CustomDropdownLinkItem>
                <div className="relative flex items-center justify-between py-1 pl-8 pr-2 text-sm">
                  <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                    <CloudSunny />
                  </span>
                  <span>Theme</span>
                  <d.ThemeToggle />
                </div>
                {secondaryLinks.map(link => (
                  <CustomDropdownLinkItem key={link.title} onClick={link.onClick} icon={<link.icon className={link.iconClassName} />}>
                    {link.title}
                  </CustomDropdownLinkItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <CustomDropdownLinkItem
              className="text-destructive hover:text-destructive focus:text-destructive"
              onClick={() => authService.logout()}
              icon={<LogOut />}
            >
              Log out
            </CustomDropdownLinkItem>
          </div>
        ) : (
          <div className="w-full space-y-1">
            <CustomDropdownLinkItem
              className="justify-center bg-primary p-2 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground focus:bg-primary/80 focus:text-primary-foreground"
              onClick={() => router.push(urlService.newSignup())}
            >
              Sign up
            </CustomDropdownLinkItem>
            <CustomDropdownLinkItem onClick={() => router.push(urlService.newLogin())} className="justify-center p-2">
              Sign in
            </CustomDropdownLinkItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function inlineItemClasses(className?: string) {
  return cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground", className);
}
