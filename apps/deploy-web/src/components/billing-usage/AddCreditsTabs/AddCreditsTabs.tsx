"use client";

import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";

import { AddCreditsForm } from "@src/components/billing-usage/AddCreditsForm/AddCreditsForm";
import { RedeemCouponForm } from "@src/components/billing-usage/RedeemCouponForm/RedeemCouponForm";

export type AddCreditsTab = "purchase" | "coupon";

export const DEPENDENCIES = {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AddCreditsForm,
  RedeemCouponForm
};

interface AddCreditsTabsProps {
  initialTab?: AddCreditsTab;
  onDone: (amount: number, organization?: string, bonusAmount?: number) => void;
  onRedeemed?: () => void;
  isWalletReady?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Splits the Add Credits sheet into a purchase flow and a coupon-redemption
 * flow. Only the active tab's content is mounted (Radix unmounts inactive
 * content), so the purchase tab's Stripe SetupIntent is created lazily and the
 * coupon form resets whenever the user switches away. The active child's
 * processing state is forwarded to the sheet's close-guard; the inactive tab
 * trigger is disabled while a flow is in progress so the user cannot navigate
 * away mid-transaction.
 */
export function AddCreditsTabs({
  initialTab = "purchase",
  onDone,
  onRedeemed,
  isWalletReady,
  onProcessingChange,
  dependencies: d = DEPENDENCIES
}: AddCreditsTabsProps) {
  const [activeTab, setActiveTab] = useState<AddCreditsTab>(initialTab);
  // Only the active tab is mounted (Radix unmounts inactive content), so a
  // single flag tracks whichever child is currently reporting.
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isProcessing);
    },
    [isProcessing, onProcessingChange]
  );

  const handleTabChange = (next: string) => {
    // Switching is blocked while processing, so the tab being left is always
    // idle here; reset so the unmounted child's state does not linger.
    setIsProcessing(false);
    setActiveTab(next as AddCreditsTab);
  };

  return (
    <d.Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <d.TabsList className="grid w-full grid-cols-2">
        <d.TabsTrigger value="purchase" disabled={isProcessing && activeTab !== "purchase"}>
          Purchase credits
        </d.TabsTrigger>
        <d.TabsTrigger value="coupon" disabled={isProcessing && activeTab !== "coupon"}>
          Redeem coupon
        </d.TabsTrigger>
      </d.TabsList>

      <d.TabsContent value="purchase">
        <d.AddCreditsForm onDone={onDone} isWalletReady={isWalletReady} onProcessingChange={setIsProcessing} />
      </d.TabsContent>

      <d.TabsContent value="coupon">
        <d.RedeemCouponForm isWalletReady={isWalletReady} onProcessingChange={setIsProcessing} onRedeemed={onRedeemed} />
      </d.TabsContent>
    </d.Tabs>
  );
}
