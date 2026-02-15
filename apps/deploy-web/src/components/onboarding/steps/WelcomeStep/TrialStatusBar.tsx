"use client";
import React from "react";
import { FormattedDate } from "react-intl";
import { Card, Skeleton } from "@akashnetwork/ui/components";
import { Check, InfoCircle, WarningTriangle, Xmark } from "iconoir-react";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useTrialBalance } from "@src/hooks/useTrialBalance";

export const TrialStatusBar: React.FC = () => {
  const { remaining: creditsRemaining, isLoading, trialEndDate, daysRemaining } = useTrialBalance();
  const { reviewStatus } = useWallet();
  const { publicConfig } = useServices();
  const reviewTrialCredits = publicConfig.NEXT_PUBLIC_REVIEW_TRIAL_CREDITS_AMOUNT;

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
            <Skeleton className="h-8 w-24" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-full max-w-64" />
              <Skeleton className="h-5 w-full max-w-80" />
            </div>
          </div>

          <div className="px-1">
            <Skeleton className="h-3 w-full max-w-xs" />
          </div>
        </div>
      </Card>
    );
  }

  if (reviewStatus === "rejected") {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
            <div className="rounded-md bg-red-600/10 px-3 py-1.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-red-600">
                <Xmark className="h-4 w-4" />
                Trial Rejected
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold sm:text-lg">Your trial has been rejected</div>
              <div className="text-xs text-muted-foreground sm:text-sm">Please contact support if you believe this is an error.</div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (reviewStatus === "pending") {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
            <div className="rounded-md bg-amber-600/10 px-3 py-1.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-amber-600">
                <WarningTriangle className="h-4 w-4" />
                Under Review
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold sm:text-lg">Free Trial Credits: ${creditsRemaining.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground sm:text-sm">
                Your account is under review. You have limited trial credits (${reviewTrialCredits}) while we verify your payment.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <InfoCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>You will receive an email once the review is complete</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
          <div className="rounded-md bg-green-600/10 px-3 py-1.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-600">
              <Check className="h-4 w-4" />
              Trial Active
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold sm:text-lg">Free Trial Credits: ${creditsRemaining.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground sm:text-sm">
              Expires on <FormattedDate value={trialEndDate} year="numeric" month="long" day="numeric" /> <span className="mx-1.5 hidden sm:inline">•</span>
              <span className="block sm:inline"> {daysRemaining} days remaining</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <InfoCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Deployments last for maximum 1 day during trial</span>
        </div>
      </div>
    </Card>
  );
};
