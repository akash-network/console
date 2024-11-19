"use client";
import React from "react";
import { Avatar, buttonVariants, Separator, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { LogOut, MediaImageList, Settings } from "iconoir-react";
import Link from "next/link";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { UrlService } from "@src/utils/urlUtils";
import { SidebarRouteButton } from "./SidebarRouteButton";
import { WalletStatus } from "./WalletStatus";

export const MobileSidebarUser: React.FunctionComponent = () => {
  const { user, isLoading } = useCustomUser();

  return (
    <ul className="w-full overflow-hidden border-0 p-0">
      <div className="flex w-full items-center justify-center p-2">
        <WalletStatus />
      </div>

      <Separator />

      {isLoading ? (
        <div className="text-center">
          <Spinner size="small" />
        </div>
      ) : user ? (
        <div className="p-2">
          {user.username && (
            <SidebarRouteButton
              route={{
                title: user.username,
                icon: props => (
                  <Avatar {...props} className="h-6 w-6">
                    {user.username && user.username[0].toUpperCase()}
                  </Avatar>
                ),
                url: UrlService.userProfile(user.username),
                activeRoutes: [UrlService.userProfile(user.username)]
              }}
            />
          )}
          {user.username && (
            <SidebarRouteButton
              route={{
                title: "Templates",
                icon: props => <MediaImageList {...props} />,
                url: UrlService.userProfile(user.username),
                activeRoutes: [UrlService.userProfile(user.username)]
              }}
            />
          )}
          <SidebarRouteButton
            route={{
              title: "Settings",
              icon: props => <Settings {...props} />,
              url: UrlService.userSettings(),
              activeRoutes: [UrlService.userSettings()]
            }}
          />
          <SidebarRouteButton
            useNextLinkTag={false}
            route={{
              title: "Logout",
              icon: props => <LogOut {...props} />,
              url: UrlService.logout(),
              activeRoutes: []
            }}
          />
        </div>
      ) : (
        <div className="p-2">
          <li>
            <Link href={UrlService.signup()} className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full")}>
              Sign up
            </Link>
          </li>
          <li>
            <Link href={UrlService.login()} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}>
              Sign in
            </Link>
          </li>
        </div>
      )}

      <Separator className="mb-4" />
    </ul>
  );
};
