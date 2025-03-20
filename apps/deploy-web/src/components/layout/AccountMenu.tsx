"use client";
import React, { useState } from "react";
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
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { Key, User } from "iconoir-react";
import { Bell, LogOut, MultiplePages, Settings, Star } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { UrlService } from "@src/utils/urlUtils";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { user, isLoading } = useCustomUser();
  const username = user?.username;
  const router = useRouter();

  return (
    <React.Fragment>
      <div className="flex items-center text-center">
        {isLoading ? (
          <div className="pl-2 pr-2">
            <Spinner size="small" />
          </div>
        ) : (
          <div className="pl-2 pr-2">
            <DropdownMenu modal={false} open={open}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => (username ? router.push(UrlService.userProfile(username)) : null)}
                  onMouseOver={() => setOpen(true)}
                >
                  <Avatar className="h-[2rem] w-[2rem]">
                    <AvatarFallback>{username ? username[0].toUpperCase() : <User />}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onMouseLeave={() => {
                  setOpen(false);
                }}
                className="w-[160px]"
              >
                <ClickAwayListener
                  onClickAway={() => {
                    setOpen(false);
                  }}
                >
                  <div className="flex w-full items-center justify-center">
                    {!isLoading && user ? (
                      <div className="w-full">
                        {username && (
                          <CustomDropdownLinkItem
                            onClick={() => router.push(UrlService.userProfile(username))}
                            icon={
                              <Avatar className="h-4 w-4">
                                <AvatarFallback className="text-xs">{username ? username[0].toUpperCase() : <User />}</AvatarFallback>
                              </Avatar>
                            }
                          >
                            {username}
                          </CustomDropdownLinkItem>
                        )}
                        <DropdownMenuSeparator />
                        <CustomDropdownLinkItem onClick={() => router.push(UrlService.userSettings())} icon={<Settings />}>
                          Profile Settings
                        </CustomDropdownLinkItem>
                        <CustomDropdownLinkItem onClick={() => router.push(UrlService.userApiKeys())} icon={<Key />}>
                          API Keys
                        </CustomDropdownLinkItem>
                        {username && (
                          <CustomDropdownLinkItem onClick={() => router.push(UrlService.userProfile(username))} icon={<MultiplePages />}>
                            Templates
                          </CustomDropdownLinkItem>
                        )}
                        <CustomDropdownLinkItem onClick={() => router.push(UrlService.userFavorites())} icon={<Star />}>
                          Favorites
                        </CustomDropdownLinkItem>
                        <CustomDropdownLinkItem onClick={() => window.open("https://blockspy.io", "_blank")?.focus()} icon={<Bell />}>
                          My Alerts
                        </CustomDropdownLinkItem>
                        <DropdownMenuSeparator />
                        <CustomDropdownLinkItem onClick={() => (window.location.href = UrlService.logout())} icon={<LogOut />}>
                          Logout
                        </CustomDropdownLinkItem>
                      </div>
                    ) : (
                      <div className="w-full space-y-1">
                        <CustomDropdownLinkItem
                          className="justify-center bg-primary p-2 !text-white hover:bg-primary/80 hover:text-white focus:bg-primary/80"
                          onClick={() => router.push(UrlService.signup())}
                        >
                          Sign up
                        </CustomDropdownLinkItem>
                        <CustomDropdownLinkItem onClick={() => router.push(UrlService.login())} className="justify-center p-2">
                          Sign in
                        </CustomDropdownLinkItem>
                      </div>
                    )}
                  </div>
                </ClickAwayListener>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
