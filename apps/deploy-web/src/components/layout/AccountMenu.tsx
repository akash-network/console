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
import { GraphUp, Key, LogOut, MultiplePages, Settings, Star, User } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useFlag } from "@src/hooks/useFlag";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { user, isLoading } = useCustomUser();
  const username = user?.username;
  const router = useRouter();
  const isBillingUsageEnabled = useFlag("billing_usage");
  const wallet = useWallet();
  const { authService, urlService } = useServices();

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
                  onClick={() => (username ? router.push(urlService.userProfile(username)) : null)}
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
                            onClick={() => router.push(urlService.userProfile(username))}
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
                        <CustomDropdownLinkItem onClick={() => router.push(urlService.userSettings())} icon={<Settings />}>
                          Profile Settings
                        </CustomDropdownLinkItem>
                        <CustomDropdownLinkItem onClick={() => router.push(urlService.userApiKeys())} icon={<Key />}>
                          API Keys
                        </CustomDropdownLinkItem>
                        {username && (
                          <CustomDropdownLinkItem onClick={() => router.push(urlService.userProfile(username))} icon={<MultiplePages />}>
                            Templates
                          </CustomDropdownLinkItem>
                        )}
                        <CustomDropdownLinkItem onClick={() => router.push(urlService.userFavorites())} icon={<Star />}>
                          Favorites
                        </CustomDropdownLinkItem>
                        {isBillingUsageEnabled && user?.userId && wallet.isManaged && (
                          <CustomDropdownLinkItem onClick={() => router.push(urlService.billing())} icon={<GraphUp />}>
                            Billing & Usage
                          </CustomDropdownLinkItem>
                        )}
                        <DropdownMenuSeparator />
                        <CustomDropdownLinkItem onClick={() => authService.logout()} icon={<LogOut />}>
                          Logout
                        </CustomDropdownLinkItem>
                      </div>
                    ) : (
                      <div className="w-full space-y-1">
                        <CustomDropdownLinkItem
                          className="justify-center bg-primary p-2 !text-white hover:bg-primary/80 hover:text-white focus:bg-primary/80"
                          onClick={() => router.push(urlService.newSignup())}
                        >
                          Sign up
                        </CustomDropdownLinkItem>
                        <CustomDropdownLinkItem onClick={() => router.push(urlService.newLogin())} className="justify-center p-2">
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
