"use client";

import { Button } from "@akashnetwork/ui/components";
import { ArrowRight } from "lucide-react";

import { useBillingSheet } from "@src/context/BillingSheetProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = {
  useFlag,
  useWallet,
  useBillingSheet
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function HackathonCouponNavEntry({ dependencies: d = DEPENDENCIES }: Props) {
  const isHackathonsEnabled = d.useFlag("hackathons");
  const { isTrialing } = d.useWallet();
  const { open: openBillingSheet } = d.useBillingSheet();

  if (!isHackathonsEnabled || !isTrialing) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => openBillingSheet({ initialTab: "coupon" })}>
      Hackathon? click here
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}
