"use client";
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTheme } from "next-themes";

import { AddPaymentMethodPopup } from "@src/components/billing-usage/AddPaymentMethodPopup/AddPaymentMethodPopup";
import { useRefreshPaymentMethods, useSetupIntentMutation } from "@src/queries";

export const DEPENDENCIES = {
  useTheme,
  useSetupIntentMutation,
  useRefreshPaymentMethods,
  AddPaymentMethodPopup
};

type BillingActions = {
  openAddPaymentMethod: () => void;
};

const BillingActionsContext = createContext<BillingActions | null>(null);

export const BillingActionsProvider: React.FunctionComponent<{ children: ReactNode; dependencies?: typeof DEPENDENCIES }> = ({
  children,
  dependencies: d = DEPENDENCIES
}) => {
  const { resolvedTheme } = d.useTheme();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const refreshPaymentMethods = d.useRefreshPaymentMethods();
  const [isOpen, setIsOpen] = useState(false);

  const openAddPaymentMethod = useCallback(() => {
    resetSetupIntent();
    createSetupIntent();
    setIsOpen(true);
  }, [createSetupIntent, resetSetupIntent]);

  const onAddCardSuccess = useCallback(async () => {
    setIsOpen(false);
    await refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  const value = useMemo(() => ({ openAddPaymentMethod }), [openAddPaymentMethod]);

  return (
    <BillingActionsContext.Provider value={value}>
      {children}
      <d.AddPaymentMethodPopup
        open={isOpen}
        onClose={() => setIsOpen(false)}
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
