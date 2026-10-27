"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@akashnetwork/ui/components";
import { CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

import { type AddCreditsTab, AddCreditsTabs } from "@src/components/billing-usage/AddCreditsTabs/AddCreditsTabs";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCanManageBilling } from "@src/hooks/useCanManageBilling";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useUserApiKeys } from "@src/queries/useApiKeysQuery";
import { useLeaseExistenceQuery } from "@src/queries/useLeaseQuery";
import { helloWorldTemplate } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  AddCreditsTabs,
  useServices,
  useWalletBalance,
  useWallet,
  useLeaseExistenceQuery,
  useUserApiKeys,
  useCanManageBilling
};

type NextStepChoice = "deploy_now" | "api_key" | "done";

type FirstDeploymentOffer = { offersDeployNow: boolean; offersApiKey: boolean };

const NO_FIRST_DEPLOYMENT_OFFER: FirstDeploymentOffer = { offersDeployNow: false, offersApiKey: false };

const DEPLOY_HELLO_WORLD_URL = UrlService.configureDeployment({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

const DEFAULT_DESCRIPTION =
  "This template needs a top-tier GPU, which isn't covered by your free trial. Add credits to unlock high-end GPUs, longer runtimes, and the full Console.";

interface AddCreditsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (amount: number, bonusAmount?: number) => void;
  onRedeemed?: () => void;
  initialTab?: AddCreditsTab;
  description?: React.ReactNode;
  /** Where the sheet was opened from (e.g. the onboarding reason); sent with the lifecycle and payment events for funnel segmentation. */
  context?: string;
  nextStepLabel?: string;
  suggestFirstDeployment?: boolean;
  deploymentDailyCostUsd?: number;
  dependencies?: typeof DEPENDENCIES;
}

/** Host it only where it stays mounted until a purchase settles: a host that hides once the trial ends must open the app-wide sheet through `useAddCredits` instead. */
export function AddCreditsSheet({
  open,
  onOpenChange,
  onDone,
  onRedeemed,
  initialTab,
  description = DEFAULT_DESCRIPTION,
  context,
  nextStepLabel = "Done",
  suggestFirstDeployment = false,
  deploymentDailyCostUsd,
  dependencies: d = DEPENDENCIES
}: AddCreditsSheetProps) {
  const { analyticsService } = d.useServices();
  const canManageBilling = d.useCanManageBilling();
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchase, setPurchase] = useState<{ amount: number; bonusAmount?: number } | null>(null);
  const purchaseDismissedRef = useRef(false);
  const wasOpenRef = useRef(false);
  /** Set once a purchase or coupon redemption completes, so closing afterward isn't reported as a cancellation. */
  const completedRef = useRef(false);

  useEffect(
    function trackOpened() {
      if (open && !wasOpenRef.current) {
        completedRef.current = false;
        purchaseDismissedRef.current = false;
        setPurchase(null);
        analyticsService.track("add_credits_opened", { category: "billing", context });
      }
      if (!open) setIsProcessing(false);
      wasOpenRef.current = open;
    },
    [open, context, analyticsService]
  );

  const requestOpenChange = (next: boolean) => {
    if (!next && isProcessing) return;
    if (!next && purchase && !purchaseDismissedRef.current) {
      purchaseDismissedRef.current = true;
      onDone(purchase.amount, purchase.bonusAmount);
    }
    if (!next && !completedRef.current) {
      analyticsService.track("add_credits_cancelled", { category: "billing", context });
    }
    onOpenChange(next);
  };

  const completePurchase = (amount: number, bonusAmount?: number) => {
    completedRef.current = true;
    setIsProcessing(false);
    setPurchase({ amount, bonusAmount });
  };

  const completeRedemption = () => {
    completedRef.current = true;
    onRedeemed?.();
  };

  const continueWithNextStep = (choice: NextStepChoice) => {
    analyticsService.track("add_credits_next_step_clicked", { category: "billing", context, choice });
    requestOpenChange(false);
  };

  const renderBody = (firstDeploymentOffer: FirstDeploymentOffer) =>
    purchase ? (
      <PurchaseSuccess
        amount={purchase.amount}
        bonusAmount={purchase.bonusAmount}
        nextStepLabel={nextStepLabel}
        firstDeploymentOffer={firstDeploymentOffer}
        onDone={() => requestOpenChange(false)}
        onNextStep={continueWithNextStep}
        dependencies={d}
      />
    ) : canManageBilling ? (
      <d.AddCreditsTabs
        initialTab={initialTab}
        context={context}
        deploymentDailyCostUsd={deploymentDailyCostUsd}
        onDone={completePurchase}
        onRedeemed={completeRedemption}
        onProcessingChange={setIsProcessing}
      />
    ) : (
      <BillingManagersOnlyNotice />
    );

  return (
    <d.Sheet open={open} onOpenChange={requestOpenChange}>
      <d.SheetContent side="right" hideCloseButton={isProcessing} className="w-full space-y-6 overflow-y-auto p-6 sm:max-w-[546px]">
        <d.SheetHeader className="space-y-2 text-left">
          <d.SheetTitle className="text-3xl font-medium leading-9">{purchase ? "Payment successful" : "Add credits"}</d.SheetTitle>
          <d.SheetDescription className="text-sm leading-5 text-muted-foreground">
            {purchase ? "Your credits are ready to use." : canManageBilling ? description : "Credits pay for your team's deployments."}
          </d.SheetDescription>
        </d.SheetHeader>

        {open &&
          (suggestFirstDeployment ? (
            <FirstDeploymentOfferLookup dependencies={d}>{renderBody}</FirstDeploymentOfferLookup>
          ) : (
            renderBody(NO_FIRST_DEPLOYMENT_OFFER)
          ))}
      </d.SheetContent>
    </d.Sheet>
  );
}

/** Wraps the purchase form too, so the lookups settle before the success screen and the offer never shows up late. */
function FirstDeploymentOfferLookup({
  children,
  dependencies: d
}: {
  children: (firstDeploymentOffer: FirstDeploymentOffer) => React.ReactNode;
  dependencies: Pick<typeof DEPENDENCIES, "useWallet" | "useLeaseExistenceQuery" | "useUserApiKeys">;
}) {
  const { address, hasWallet } = d.useWallet();
  const leaseExistenceQuery = d.useLeaseExistenceQuery(address, { enabled: hasWallet && !!address });
  const hasNoLease = leaseExistenceQuery.isSuccess && leaseExistenceQuery.data === false;
  const apiKeysQuery = d.useUserApiKeys({ enabled: hasNoLease, refetchInterval: false, retry: false });
  const isApiKeysSettled = apiKeysQuery.isSuccess || apiKeysQuery.isError;

  return children({
    offersDeployNow: hasNoLease && isApiKeysSettled,
    offersApiKey: hasNoLease && apiKeysQuery.isSuccess && !!apiKeysQuery.data?.length
  });
}

function BillingManagersOnlyNotice() {
  return (
    <div role="status" className="space-y-3 rounded-lg border p-6 text-center">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">Only owners and billing members can add credits</p>
      <p className="text-sm text-muted-foreground">Ask one of them to top up your team&apos;s balance or add a payment method.</p>
    </div>
  );
}

function PurchaseSuccess({
  amount,
  bonusAmount,
  nextStepLabel,
  firstDeploymentOffer,
  onDone,
  onNextStep,
  dependencies: d
}: {
  amount: number;
  bonusAmount?: number;
  nextStepLabel: string;
  firstDeploymentOffer: FirstDeploymentOffer;
  onDone: () => void;
  onNextStep: (choice: NextStepChoice) => void;
  dependencies: Pick<typeof DEPENDENCIES, "useWalletBalance">;
}) {
  const { balance, isLoading } = d.useWalletBalance();
  const { offersDeployNow, offersApiKey } = firstDeploymentOffer;

  return (
    <div className="space-y-6">
      <div role="status" className="space-y-3 rounded-lg border p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
        <p className="text-lg font-medium">{formatUsd(amount)} credits added</p>
        {!!bonusAmount && <p className="text-sm text-muted-foreground">Plus {formatUsd(bonusAmount)} in bonus credits</p>}
        <p className="text-sm text-muted-foreground">New balance</p>
        <p className="text-3xl font-semibold">{balance && !isLoading ? formatUsd(balance.totalUsd) : "Updating balance…"}</p>
      </div>
      {offersDeployNow ? (
        <FirstDeploymentNextSteps offersApiKey={offersApiKey} doneLabel={nextStepLabel} onNextStep={onNextStep} />
      ) : (
        <Button className="w-full" onClick={onDone}>
          {nextStepLabel}
        </Button>
      )}
    </div>
  );
}

function FirstDeploymentNextSteps({
  offersApiKey,
  doneLabel,
  onNextStep
}: {
  offersApiKey: boolean;
  doneLabel: string;
  onNextStep: (choice: NextStepChoice) => void;
}) {
  return (
    <div className="space-y-3">
      <Button asChild className="w-full">
        <Link href={DEPLOY_HELLO_WORLD_URL} onClick={() => onNextStep("deploy_now")}>
          Deploy now
        </Link>
      </Button>
      {offersApiKey && (
        <Button asChild variant="outline" className="w-full">
          <Link href={UrlService.userApiKeys()} onClick={() => onNextStep("api_key")}>
            Deploy with your API key or agent
          </Link>
        </Button>
      )}
      <Button variant="ghost" className="w-full" onClick={() => onNextStep("done")}>
        {doneLabel}
      </Button>
    </div>
  );
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
