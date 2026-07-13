"use client";

import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowRight } from "lucide-react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = {
  useFlag,
  useWallet,
  AddCreditsSheet
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function HackathonCouponNavEntry({ dependencies: d = DEPENDENCIES }: Props) {
  const isHackathonsEnabled = d.useFlag("hackathons");
  const { isTrialing, isWalletLoaded, address } = d.useWallet();
  const [open, setOpen] = useState(false);

  if (!isHackathonsEnabled || !isTrialing) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Hackathon? click here
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <d.AddCreditsSheet open={open} onOpenChange={setOpen} initialTab="coupon" isWalletReady={isWalletLoaded && !!address} onDone={() => setOpen(false)} />
    </>
  );
}
