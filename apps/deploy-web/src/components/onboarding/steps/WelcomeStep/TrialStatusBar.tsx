"use client";
import React from "react";
import { FormattedDate } from "react-intl";
import { Card, Progress, Skeleton } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useTrialBalance } from "@src/hooks/useTrialBalance";

export const TrialStatusBar: React.FC = () => {
  const { total: TRIAL_TOTAL, remaining: creditsRemaining, used: creditsUsed, remainingPercentage, isLoading, trialEndDate, daysRemaining } = useTrialBalance();

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

          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <div className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between sm:text-sm">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
          <div className="rounded-md bg-green-500/10 px-3 py-1.5">
            <span className="whitespace-nowrap text-sm font-semibold text-green-500">Trial Active</span>
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

        <div className="space-y-2">
          <Progress value={remainingPercentage} className="h-2" />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <span>${creditsUsed.toFixed(2)} used</span>
            <span>
              ${creditsRemaining.toFixed(2)} remaining of ${TRIAL_TOTAL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
