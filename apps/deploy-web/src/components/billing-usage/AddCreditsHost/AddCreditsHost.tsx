"use client";
import { useState } from "react";
import { useAtom } from "jotai";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { PaymentSuccessAnimation } from "@src/components/billing-usage/PaymentSuccessAnimation/PaymentSuccessAnimation";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";

export const DEPENDENCIES = { AddCreditsSheet, PaymentSuccessAnimation };

const DEFAULT_DESCRIPTION = "Buy credits or redeem a coupon to top up your balance.";

type CompletedPurchase = { amount: string; bonusAmount: string };

/**
 * Hosts the single Add Credits sheet that any call site opens through `useAddCredits`. Mounted above the
 * onboarding gate so an open sheet survives a redirect, and cheap while closed because the sheet only mounts
 * its Stripe form once open.
 */
export function AddCreditsHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const [request, setRequest] = useAtom(addCreditsRequestAtom);
  const [completedPurchase, setCompletedPurchase] = useState<CompletedPurchase | null>(null);

  const closeSheet = () => setRequest(null);

  return (
    <>
      <d.PaymentSuccessAnimation
        show={!!completedPurchase}
        amount={completedPurchase?.amount ?? ""}
        bonusAmount={completedPurchase?.bonusAmount ?? ""}
        onComplete={() => setCompletedPurchase(null)}
      />

      <d.AddCreditsSheet
        open={!!request}
        onOpenChange={isOpen => (!isOpen ? closeSheet() : undefined)}
        initialTab={request?.initialTab ?? "purchase"}
        description={request?.description ?? DEFAULT_DESCRIPTION}
        context={request?.context}
        onDone={(amount, _organization, bonusAmount) => {
          setCompletedPurchase({ amount: String(amount), bonusAmount: String(bonusAmount ?? 0) });
          closeSheet();
        }}
        onRedeemed={closeSheet}
      />
    </>
  );
}
