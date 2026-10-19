"use client";
import { useAtom } from "jotai";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";

export const DEPENDENCIES = { AddCreditsSheet };

const DEFAULT_DESCRIPTION = "Buy credits or redeem a coupon to top up your balance.";

/**
 * Hosts the single Add Credits sheet that any call site opens through `useAddCredits`. Mounted above the
 * onboarding gate so an open sheet survives a redirect, and cheap while closed because the sheet only mounts
 * its Stripe form once open.
 */
export function AddCreditsHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const [request, setRequest] = useAtom(addCreditsRequestAtom);

  const closeSheet = () => setRequest(null);

  const closeSheetAfterPurchase = () => {
    closeSheet();
    request?.onCreditsAdded?.();
  };

  return (
    <d.AddCreditsSheet
      open={!!request}
      onOpenChange={isOpen => (!isOpen ? closeSheet() : undefined)}
      initialTab={request?.initialTab ?? "purchase"}
      description={request?.description ?? DEFAULT_DESCRIPTION}
      context={request?.context}
      nextStepLabel={request?.nextStepLabel}
      onDone={closeSheetAfterPurchase}
      onRedeemed={closeSheet}
    />
  );
}
