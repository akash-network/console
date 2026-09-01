"use client";
import * as React from "react";
import { HandCard } from "iconoir-react";

import { AddFundsButton } from "@src/components/user/AddFundsButton";

export type TrialDeploymentTooltipProps = {
  createdHeight?: number;
  isExpired: boolean;
  timeRemainingText: string | null;
  trialDuration: number;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  AddFundsButton
};

const ADD_CREDITS_DESCRIPTION = "Add credits to activate your account, so trial deployments stop closing on their own.";

export function TrialDeploymentTooltip({
  createdHeight,
  isExpired,
  timeRemainingText,
  trialDuration,
  dependencies: d = DEPENDENCIES
}: TrialDeploymentTooltipProps) {
  if (!createdHeight) {
    return (
      <div className="space-y-2 text-left">
        <div className="space-y-1">
          <p className="font-medium">Trial Deployment</p>
          <p className="text-xs text-muted-foreground">Trial deployments are automatically closed after {trialDuration} hours.</p>
        </div>
        <AddFunds dependencies={d} />
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="space-y-2 text-left">
        <p className="text-sm">This trial deployment has expired and will be closed automatically.</p>
        <AddFunds dependencies={d} />
      </div>
    );
  }

  return (
    <div className="space-y-2 text-left">
      <div className="space-y-1">
        <p className="font-medium">Trial Deployment</p>
        <p className="text-sm text-muted-foreground">
          Time remaining: <span className="font-medium text-primary">{timeRemainingText}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Trial deployments are automatically closed after <span className="font-medium text-primary">{trialDuration}</span> hours.
        </p>
      </div>
      <AddFunds dependencies={d} />
    </div>
  );
}

const AddFunds = ({ dependencies: d = DEPENDENCIES }: { dependencies: typeof DEPENDENCIES }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs">Add funds to activate your account.</p>
    <d.AddFundsButton
      className="w-full space-x-2"
      request={{ initialTab: "purchase", description: ADD_CREDITS_DESCRIPTION, context: "trial_deployment_badge" }}
    >
      <HandCard className="text-xs" />
      <span className="whitespace-nowrap">Add Funds</span>
    </d.AddFundsButton>
  </div>
);
