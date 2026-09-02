"use client";
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@akashnetwork/ui/hooks";
import { useTheme } from "next-themes";

import { AddPaymentMethodPopup } from "@src/components/billing-usage/AddPaymentMethodPopup/AddPaymentMethodPopup";
import { useRefreshPaymentMethods, useSetupIntentMutation } from "@src/queries";

export const DEPENDENCIES = {
  useTheme,
  useToast,
  useSetupIntentMutation,
  useRefreshPaymentMethods,
  AddPaymentMethodPopup
};

type BillingActions = {
  /** `onSuccess` runs only for the card this call opens, and is dropped if the popup closes or errors first. */
  openAddPaymentMethod: (options?: { onSuccess?: () => void }) => void;
};

const BillingActionsContext = createContext<BillingActions | null>(null);

export const BillingActionsProvider: React.FunctionComponent<{ children: ReactNode; dependencies?: typeof DEPENDENCIES }> = ({
  children,
  dependencies: d = DEPENDENCIES
}) => {
  const { resolvedTheme } = d.useTheme();
  const { toast } = d.useToast();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent, isError: isSetupIntentError } = d.useSetupIntentMutation();
  const refreshPaymentMethods = d.useRefreshPaymentMethods();
  const [isOpen, setIsOpen] = useState(false);
  const pendingOnSuccess = useRef<(() => void) | undefined>(undefined);

  const openAddPaymentMethod = useCallback(
    (options?: { onSuccess?: () => void }) => {
      pendingOnSuccess.current = options?.onSuccess;
      resetSetupIntent();
      createSetupIntent();
      setIsOpen(true);
    },
    [createSetupIntent, resetSetupIntent]
  );

  const closeAddPaymentMethod = useCallback(() => {
    pendingOnSuccess.current = undefined;
    setIsOpen(false);
  }, []);

  useEffect(
    function notifyAndClosePopupOnSetupIntentError() {
      if (!isSetupIntentError) return;
      closeAddPaymentMethod();
      toast({ title: "Couldn't start adding a payment method", description: "Please try again.", variant: "destructive" });
    },
    [isSetupIntentError, toast, closeAddPaymentMethod]
  );

  const onAddCardSuccess = useCallback(async () => {
    const onSuccess = pendingOnSuccess.current;
    closeAddPaymentMethod();
    await refreshPaymentMethods();
    onSuccess?.();
  }, [refreshPaymentMethods, closeAddPaymentMethod]);

  const value = useMemo(() => ({ openAddPaymentMethod }), [openAddPaymentMethod]);

  return (
    <BillingActionsContext.Provider value={value}>
      {children}
      <d.AddPaymentMethodPopup
        open={isOpen && !isSetupIntentError}
        onClose={closeAddPaymentMethod}
        clientSecret={setupIntent?.clientSecret}
        isDarkMode={resolvedTheme === "dark"}
        onSuccess={onAddCardSuccess}
      />
    </BillingActionsContext.Provider>
  );
};

export function useBillingActions(): BillingActions {
  const context = useContext(BillingActionsContext);
  if (!context) {
    throw new Error("useBillingActions must be used within a BillingActionsProvider");
  }
  return context;
}
