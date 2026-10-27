"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useCanManageBilling } from "@src/hooks/useCanManageBilling";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery } from "@src/queries";

export const DEPENDENCIES = {
  useDefaultPaymentMethodQuery,
  useWalletBalance,
  useSearchParams,
  useRouter,
  useServices,
  useCanManageBilling,
  AddCreditsSheet,
  Button
};

export const AddToBalanceButton: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [showAddCredits, setShowAddCredits] = useState(false);
  const { isLoading: isLoadingDefaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { isLoading: isWalletBalanceLoading } = d.useWalletBalance();
  const searchParams = d.useSearchParams();
  const router = d.useRouter();
  const { urlService } = d.useServices();
  const canManageBilling = d.useCanManageBilling();

  useEffect(() => {
    if (!isLoadingDefaultPaymentMethod && searchParams.get("openPayment") === "true") {
      setShowAddCredits(true);
      router.replace(urlService.billing(), { scroll: false });
    }
  }, [isLoadingDefaultPaymentMethod, searchParams, router, urlService]);

  if (!canManageBilling) return null;

  return (
    <>
      <d.Button onClick={() => setShowAddCredits(true)} disabled={isWalletBalanceLoading} size="sm">
        <Plus className="h-4 w-4" />
        Add to Balance
      </d.Button>

      <d.AddCreditsSheet
        open={showAddCredits}
        onOpenChange={setShowAddCredits}
        initialTab="purchase"
        description="Buy credits or redeem a coupon to top up your balance."
        suggestFirstDeployment
        onDone={() => setShowAddCredits(false)}
      />
    </>
  );
};
