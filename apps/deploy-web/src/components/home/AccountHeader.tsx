"use client";
import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus, Rocket } from "iconoir-react";
import Link from "next/link";

import { AddFundsLink } from "@src/components/user/AddFundsLink";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  isManagedWallet: boolean;
  onDeployClick: () => void;
  isBlockchainDown: boolean;
};

export const AccountHeader: React.FC<Props> = ({ isManagedWallet, onDeployClick, isBlockchainDown }) => {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-semibold">Your account</h3>
      <div className="flex gap-2">
        {isManagedWallet && (
          <AddFundsLink className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")} href={UrlService.payment()}>
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">Add Funds</span>
          </AddFundsLink>
        )}
        <Link
          href={UrlService.newDeployment()}
          className={cn(buttonVariants({ variant: "default" }), "flex items-center gap-2")}
          onClick={onDeployClick}
          aria-disabled={isBlockchainDown}
        >
          <Rocket className="rotate-45" fontSize="small" />
          <span>Deploy</span>
        </Link>
      </div>
    </div>
  );
};
