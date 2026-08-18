"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Plus } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { PaymentSuccessAnimation } from "@src/components/billing-usage/PaymentSuccessAnimation/PaymentSuccessAnimation";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery } from "@src/queries";

export const DEPENDENCIES = {
  useDefaultPaymentMethodQuery,
  useWalletBalance,
  useSearchParams,
  useRouter,
  useServices,
  AddCreditsSheet,
  PaymentSuccessAnimation,
  Button
};

export const AddToBalanceButton: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; bonusAmount: string; show: boolean }>({
    amount: "",
    bonusAmount: "",
    show: false
  });
  const { isLoading: isLoadingDefaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { isLoading: isWalletBalanceLoading } = d.useWalletBalance();
  const searchParams = d.useSearchParams();
  const router = d.useRouter();
  const { urlService } = d.useServices();

  useEffect(() => {
    if (!isLoadingDefaultPaymentMethod && searchParams.get("openPayment") === "true") {
      setShowAddCredits(true);
      router.replace(urlService.billing(), { scroll: false });
    }
  }, [isLoadingDefaultPaymentMethod, searchParams, router, urlService]);

  return (
    <>
      <d.Button onClick={() => setShowAddCredits(true)} disabled={isWalletBalanceLoading} size="sm">
        <Plus className="h-4 w-4" />
        Add to Balance
      </d.Button>

      <d.PaymentSuccessAnimation
        show={showPaymentSuccess.show}
        amount={showPaymentSuccess.amount}
        bonusAmount={showPaymentSuccess.bonusAmount}
        onComplete={() => setShowPaymentSuccess({ amount: "", bonusAmount: "", show: false })}
      />

      <d.AddCreditsSheet
        open={showAddCredits}
        onOpenChange={setShowAddCredits}
        initialTab="purchase"
        description="Buy credits or redeem a coupon to top up your balance."
        onDone={(amount, _organization, bonusAmount) => {
          setShowPaymentSuccess({ amount: String(amount), bonusAmount: String(bonusAmount ?? 0), show: true });
          setShowAddCredits(false);
        }}
      />
    </>
  );
};
