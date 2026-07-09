"use client";

import { useState } from "react";
import { buttonVariants, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Gift } from "iconoir-react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = {
  useFlag,
  useWallet,
  AddCreditsSheet
};

type Props = {
  isNavOpen: boolean;
  dependencies?: typeof DEPENDENCIES;
};

const LABEL = "Coming from a hackathon?";

export function HackathonCouponSidebarEntry({ isNavOpen, dependencies: d = DEPENDENCIES }: Props) {
  const isHackathonsEnabled = d.useFlag("hackathons");
  const { isTrialing, isWalletLoaded, address } = d.useWallet();
  const [open, setOpen] = useState(false);

  if (!isHackathonsEnabled || !isTrialing) return null;

  const trigger = (
    <button
      type="button"
      aria-label={LABEL}
      onClick={() => setOpen(true)}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex w-full items-center justify-start text-current hover:no-underline", {
        ["min-w-[initial] px-4 py-1"]: isNavOpen,
        ["w-[45px] min-w-0 p-2"]: !isNavOpen
      })}
    >
      <span className={cn("z-[100] min-w-0", { ["m-[initial]"]: isNavOpen, ["mx-auto"]: !isNavOpen })}>
        <Gift className={cn("text-xs", { ["mx-auto"]: !isNavOpen })} />
      </span>
      {isNavOpen && <span className="mb-1 ml-4 mt-1 min-w-0 flex-auto whitespace-nowrap text-left">{LABEL}</span>}
    </button>
  );

  return (
    <div className="mt-6 w-full">
      {isNavOpen ? (
        trigger
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">
              <p>{LABEL}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <d.AddCreditsSheet open={open} onOpenChange={setOpen} initialTab="coupon" isWalletReady={isWalletLoaded && !!address} onDone={() => setOpen(false)} />
    </div>
  );
}
