"use client";
import * as React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { HandCard } from "iconoir-react";

import { AddFundsLink } from "@src/components/user/AddFundsLink";
import { useServices } from "@src/context/ServicesProvider";

export type TrialDeploymentTooltipProps = {
  createdHeight?: number;
  isExpired: boolean;
  timeRemainingText: string | null;
  trialDuration: number;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  AddFundsLink
};

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

const AddFunds = ({ dependencies: d = DEPENDENCIES }: { dependencies: typeof DEPENDENCIES }) => {
  const { urlService } = useServices();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs">Add funds to activate your account.</p>
      <d.AddFundsLink className={cn("w-full space-x-2 hover:no-underline", buttonVariants({ variant: "default" }))} href={urlService.payment()}>
        <HandCard className="text-xs" />
        <span className="whitespace-nowrap">Add Funds</span>
      </d.AddFundsLink>
    </div>
  );
};
