"use client";

import { Button } from "@akashnetwork/ui/components";
import { ArrowRight } from "lucide-react";

import { useWallet } from "@src/context/WalletProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = {
  useFlag,
  useWallet,
  useAddCredits
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function HackathonCouponNavEntry({ dependencies: d = DEPENDENCIES }: Props) {
  const isHackathonsEnabled = d.useFlag("hackathons");
  const { isTrialing } = d.useWallet();
  const openAddCredits = d.useAddCredits();

  if (!isHackathonsEnabled || !isTrialing) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => openAddCredits({ initialTab: "coupon" })}>
      Hackathon? click here
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}
