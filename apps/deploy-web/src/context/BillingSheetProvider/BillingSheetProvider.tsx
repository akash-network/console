"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import type { AddCreditsTab } from "@src/components/billing-usage/AddCreditsTabs/AddCreditsTabs";
import { useWallet } from "@src/context/WalletProvider";

export interface BillingSheetOptions {
  initialTab?: AddCreditsTab;
  description?: ReactNode;
  /** Follow-up after a successful purchase — navigation/refresh only. Presentation is owned centrally. */
  onSuccess?: (amount: number, organization?: string, bonusAmount?: number) => void;
  /** Follow-up after a coupon redemption. */
  onRedeemed?: () => void;
}

export interface BillingSheetContextType {
  open: (options?: BillingSheetOptions) => void;
  close: () => void;
  isOpen: boolean;
}

const BillingSheetContext = createContext<BillingSheetContextType | null>(null);

export const DEPENDENCIES = {
  useWallet,
  AddCreditsSheet
};

export interface BillingSheetProviderProps {
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Owns the single Add Credits sheet for the authenticated app. Any surface opens it via
 * {@link useBillingSheet}, passing only its own follow-up (`onSuccess`/`onRedeemed`) and copy.
 * Wallet readiness is read centrally from `useWallet().hasManagedWallet` and stays reactive, so the
 * charge auto-fires everywhere the moment the managed wallet is provisioned while the sheet is open.
 */
export const BillingSheetProvider: React.FC<BillingSheetProviderProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { hasManagedWallet } = d.useWallet();
  const [options, setOptions] = useState<BillingSheetOptions | null>(null);
  const isOpen = options !== null;

  const open = useCallback((next?: BillingSheetOptions) => setOptions(next ?? {}), []);
  const close = useCallback(() => setOptions(null), []);
  const value = useMemo<BillingSheetContextType>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <BillingSheetContext.Provider value={value}>
      {children}
      <d.AddCreditsSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        isWalletReady={hasManagedWallet}
        initialTab={options?.initialTab}
        description={options?.description}
        onDone={runSuccessFollowUp}
        onRedeemed={runRedeemedFollowUp}
      />
    </BillingSheetContext.Provider>
  );

  function handleOpenChange(next: boolean) {
    if (!next) setOptions(null);
  }

  function runSuccessFollowUp(amount: number, organization?: string, bonusAmount?: number) {
    options?.onSuccess?.(amount, organization, bonusAmount);
    setOptions(null);
  }

  function runRedeemedFollowUp() {
    options?.onRedeemed?.();
    setOptions(null);
  }
};

export const useBillingSheet = (): BillingSheetContextType => {
  const context = useContext(BillingSheetContext);
  if (!context) {
    throw new Error("useBillingSheet must be used within a BillingSheetProvider");
  }
  return context;
};
