"use client";
import React from "react";
import { Card, Progress, Skeleton } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useTrialBalance } from "@src/hooks/useWalletBalance";

interface TrialStatusBarProps {
  showDeploymentLimit?: boolean;
}

export const TrialStatusBar: React.FC<TrialStatusBarProps> = ({ showDeploymentLimit = true }) => {
  const { total: TRIAL_TOTAL, remaining: creditsRemaining, used: creditsUsed, usagePercentage, isLoading, trialEndDate, daysRemaining } = useTrialBalance();

  const formatExpirationDate = (date: Date | null): string => {
    if (!date) return "Loading...";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Skeleton className="h-8 w-24" />
              <div className="space-y-1">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-5 w-80" />
              </div>
            </div>
            {showDeploymentLimit && <Skeleton className="h-5 w-72" />}
          </div>

          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
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
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="rounded-md bg-green-500/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-green-500">Trial Active</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold">Free Trial Credits: ${creditsRemaining.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">
                Expires on {formatExpirationDate(trialEndDate)} <span className="mx-2">•</span> {daysRemaining} days remaining
              </div>
            </div>
          </div>
          {showDeploymentLimit && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <InfoCircle className="h-4 w-4" />
              <span>Deployments last for maximum 1 day during trial</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Progress value={usagePercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
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
