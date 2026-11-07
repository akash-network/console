"use client";
import { useEffect } from "react";
import { useAtom } from "jotai";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";

export const DEPENDENCIES = { AddCreditsSheet, useServices, useUser };

const DEFAULT_DESCRIPTION = "Buy credits or redeem a coupon to top up your balance.";

/**
 * Hosts the single Add Credits sheet that any call site opens through `useAddCredits`. Mounted above the
 * onboarding gate so an open sheet survives a redirect. The sheet mounts its Stripe form only once open, but a
 * signed-in user's Stripe instance is loaded up front so the card form does not wait for it.
 */
export function AddCreditsHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const [request, setRequest] = useAtom(addCreditsRequestAtom);
  const { stripeService } = d.useServices();
  const { user } = d.useUser();
  const isSignedIn = !!user?.id;

  useEffect(
    function preloadStripeForSignedInUser() {
      if (isSignedIn) void stripeService.load();
    },
    [isSignedIn, stripeService]
  );

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
      deploymentDailyCostUsd={request?.deploymentDailyCostUsd}
      context={request?.context}
      nextStepLabel={request?.nextStepLabel}
      suggestFirstDeployment={request?.suggestFirstDeployment ?? !request?.nextStepLabel}
      onDone={closeSheetAfterPurchase}
      onRedeemed={closeSheet}
    />
  );
}
