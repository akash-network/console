"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@akashnetwork/ui/components";
import { CheckCircle2 } from "lucide-react";

import { type AddCreditsTab, AddCreditsTabs } from "@src/components/billing-usage/AddCreditsTabs/AddCreditsTabs";
import { useServices } from "@src/context/ServicesProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";

export const DEPENDENCIES = {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  AddCreditsTabs,
  useServices,
  useWalletBalance
};

const DEFAULT_DESCRIPTION =
  "This template needs a top-tier GPU, which isn't covered by your free trial. Add credits to unlock high-end GPUs, longer runtimes, and the full Console.";

interface AddCreditsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (amount: number, bonusAmount?: number) => void;
  onRedeemed?: () => void;
  initialTab?: AddCreditsTab;
  description?: React.ReactNode;
  /** Where the sheet was opened from (e.g. the onboarding reason); sent with the lifecycle and payment events for funnel segmentation. */
  context?: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Host it only where it stays mounted until a purchase settles: a host that hides once the trial ends must open the app-wide sheet through `useAddCredits` instead. */
export function AddCreditsSheet({
  open,
  onOpenChange,
  onDone,
  onRedeemed,
  initialTab,
  description = DEFAULT_DESCRIPTION,
  context,
  dependencies: d = DEPENDENCIES
}: AddCreditsSheetProps) {
  const { analyticsService } = d.useServices();
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchase, setPurchase] = useState<{ amount: number; bonusAmount?: number } | null>(null);
  const purchaseDismissedRef = useRef(false);
  const wasOpenRef = useRef(false);
  /** Set once a purchase or coupon redemption completes, so closing afterward isn't reported as a cancellation. */
  const completedRef = useRef(false);

  useEffect(
    function trackOpened() {
      if (open && !wasOpenRef.current) {
        completedRef.current = false;
        purchaseDismissedRef.current = false;
        setPurchase(null);
        analyticsService.track("add_credits_opened", { category: "billing", context });
      }
      if (!open) setIsProcessing(false);
      wasOpenRef.current = open;
    },
    [open, context, analyticsService]
  );

  const requestOpenChange = (next: boolean) => {
    if (!next && isProcessing) return;
    if (!next && purchase && !purchaseDismissedRef.current) {
      purchaseDismissedRef.current = true;
      onDone(purchase.amount, purchase.bonusAmount);
    }
    if (!next && !completedRef.current) {
      analyticsService.track("add_credits_cancelled", { category: "billing", context });
    }
    onOpenChange(next);
  };

  const completePurchase = (amount: number, bonusAmount?: number) => {
    completedRef.current = true;
    setIsProcessing(false);
    setPurchase({ amount, bonusAmount });
  };

  const completeRedemption = () => {
    completedRef.current = true;
    onRedeemed?.();
  };

  return (
    <d.Sheet open={open} onOpenChange={requestOpenChange}>
      <d.SheetContent side="right" hideCloseButton={isProcessing} className="w-full space-y-6 overflow-y-auto p-6 sm:max-w-[546px]">
        <d.SheetHeader className="space-y-2 text-left">
          <d.SheetTitle className="text-3xl font-medium leading-9">{purchase ? "Payment successful" : "Add credits"}</d.SheetTitle>
          <d.SheetDescription className="text-sm leading-5 text-muted-foreground">
            {purchase ? "Your credits are ready to use." : description}
          </d.SheetDescription>
        </d.SheetHeader>

        {open && purchase && (
          <PurchaseSuccess amount={purchase.amount} bonusAmount={purchase.bonusAmount} onDone={() => requestOpenChange(false)} dependencies={d} />
        )}

        {open && !purchase && (
          <d.AddCreditsTabs
            initialTab={initialTab}
            context={context}
            onDone={completePurchase}
            onRedeemed={completeRedemption}
            onProcessingChange={setIsProcessing}
          />
        )}
      </d.SheetContent>
    </d.Sheet>
  );
}

function PurchaseSuccess({
  amount,
  bonusAmount,
  onDone,
  dependencies: d
}: {
  amount: number;
  bonusAmount?: number;
  onDone: () => void;
  dependencies: Pick<typeof DEPENDENCIES, "useWalletBalance">;
}) {
  const { balance, isLoading } = d.useWalletBalance();

  return (
    <div className="space-y-6">
      <div role="status" className="space-y-3 rounded-lg border p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
        <p className="text-lg font-medium">{formatUsd(amount)} credits added</p>
        {!!bonusAmount && <p className="text-sm text-muted-foreground">Plus {formatUsd(bonusAmount)} in bonus credits</p>}
        <p className="text-sm text-muted-foreground">New balance</p>
        <p className="text-3xl font-semibold">{balance && !isLoading ? formatUsd(balance.totalUsd) : "Updating balance…"}</p>
      </div>
      <Button className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
