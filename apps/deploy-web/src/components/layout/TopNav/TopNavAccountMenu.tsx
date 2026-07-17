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
}

const DOCS_URL = "https://akash.network/docs";

export function TopNavAccountMenu({ dependencies: d = DEPENDENCIES, minimal = false }: Props = {}) {
  const { user, isLoading } = d.useCustomUser();
  const username = user?.username;
  const router = d.useRouter();
  const { authService, urlService } = useServices();

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
                <CustomDropdownLinkItem onClick={() => router.push(urlService.userSettings())} icon={<User />}>
                  Profile
                </CustomDropdownLinkItem>
                <div className="relative flex items-center justify-between py-1 pl-8 pr-2 text-sm">
                  <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                    <CloudSunny />
                  </span>
                  <span>Theme</span>
                  <d.ThemeToggle />
                </div>
                <CustomDropdownLinkItem onClick={() => window.open(DOCS_URL, "_blank", "noreferrer noopener")} icon={<Book />}>
                  Docs
                </CustomDropdownLinkItem>
                <CustomDropdownLinkItem onClick={() => router.push(urlService.privacyPolicy())} icon={<ShieldCheck />}>
                  Privacy Policy
                </CustomDropdownLinkItem>
                <CustomDropdownLinkItem onClick={() => router.push(urlService.termsOfService())} icon={<Page />}>
                  Terms of Service
                </CustomDropdownLinkItem>
                <CustomDropdownLinkItem onClick={() => router.push(urlService.contact())} icon={<Send className="-rotate-45" />}>
                  Contact us
                </CustomDropdownLinkItem>
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
