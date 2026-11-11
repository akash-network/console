"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { AccountSpendGate } from "@src/components/user/AccountActionGate/AccountActionGate";
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
  Button,
  AccountSpendGate
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
      <d.AccountSpendGate>
        <d.Button onClick={() => setShowAddCredits(true)} disabled={isWalletBalanceLoading} size="sm">
          <Plus className="h-4 w-4" />
          Add to Balance
        </d.Button>
      </d.AccountSpendGate>

      <d.AddCreditsSheet
        open={showAddCredits}
        onOpenChange={setShowAddCredits}
        initialTab="purchase"
        context="billing_add_to_balance"
        suggestFirstDeployment
        onDone={() => setShowAddCredits(false)}
      />
    </>
  );
};
