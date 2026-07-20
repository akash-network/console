"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@akashnetwork/ui/components";

import { type AddCreditsTab, AddCreditsTabs } from "@src/components/billing-usage/AddCreditsTabs/AddCreditsTabs";
import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  AddCreditsTabs,
  useServices
};

const DEFAULT_DESCRIPTION =
  "This template needs a top-tier GPU, which isn't covered by your free trial. Add credits to unlock high-end GPUs, longer runtimes, and the full Console.";

interface AddCreditsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (amount: number, organization?: string, bonusAmount?: number) => void;
  onRedeemed?: () => void;
  isWalletReady?: boolean;
  initialTab?: AddCreditsTab;
  description?: React.ReactNode;
  /** Where the sheet was opened from (e.g. the onboarding reason); sent with the lifecycle events for funnel segmentation. */
  context?: string;
  dependencies?: typeof DEPENDENCIES;
}

export function AddCreditsSheet({
  open,
  onOpenChange,
  onDone,
  onRedeemed,
  isWalletReady,
  initialTab,
  description = DEFAULT_DESCRIPTION,
  context,
  dependencies: d = DEPENDENCIES
}: AddCreditsSheetProps) {
  const { analyticsService } = d.useServices();
  const [isProcessing, setIsProcessing] = useState(false);
  const wasOpenRef = useRef(false);
  /** Set once a purchase or coupon redemption completes, so closing afterward isn't reported as a cancellation. */
  const completedRef = useRef(false);

  useEffect(
    function trackOpened() {
      if (open && !wasOpenRef.current) {
        completedRef.current = false;
        analyticsService.track("add_credits_opened", { category: "billing", context });
      }
      wasOpenRef.current = open;
    },
    [open, context, analyticsService]
  );

  const requestOpenChange = (next: boolean) => {
    if (!next && isProcessing) return;
    if (!next && !completedRef.current) {
      analyticsService.track("add_credits_cancelled", { category: "billing", context });
    }
    onOpenChange(next);
  };

  const completePurchase = (amount: number, organization?: string, bonusAmount?: number) => {
    completedRef.current = true;
    analyticsService.track("add_credits_purchased", { category: "billing", amount, context });
    onDone(amount, organization, bonusAmount);
  };

  const completeRedemption = () => {
    completedRef.current = true;
    onRedeemed?.();
  };

  return (
    <d.Sheet open={open} onOpenChange={requestOpenChange}>
      <d.SheetContent side="right" hideCloseButton={isProcessing} className="w-full space-y-6 overflow-y-auto p-6 sm:max-w-[546px]">
        <d.SheetHeader className="space-y-2 text-left">
          <d.SheetTitle className="text-3xl font-medium leading-9">Add credits</d.SheetTitle>
          <d.SheetDescription className="text-sm leading-5 text-muted-foreground">{description}</d.SheetDescription>
        </d.SheetHeader>

        {open && (
          <d.AddCreditsTabs
            initialTab={initialTab}
            onDone={completePurchase}
            onRedeemed={completeRedemption}
            isWalletReady={isWalletReady}
            onProcessingChange={setIsProcessing}
          />
        )}
      </d.SheetContent>
    </d.Sheet>
  );
}
