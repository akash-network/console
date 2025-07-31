"use client";
import * as React from "react";
import { Badge, buttonVariants, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { HandCard } from "iconoir-react";
import { Info } from "lucide-react";

import { AddFundsLink } from "@src/components/user/AddFundsLink";
import { useBlock } from "@src/queries/useBlocksQuery";
import { calculateTrialTimeRemaining, formatTrialTimeRemaining } from "@src/utils/trialDeploymentUtils";
import { UrlService } from "@src/utils/urlUtils";

export type Props = {
  createdHeight?: number;
  trialDurationHours?: number;
  averageBlockTime?: number;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  Badge,
  CustomTooltip,
  cn,
  Info,
  HandCard,
  useBlock,
  calculateTrialTimeRemaining,
  formatTrialTimeRemaining,
  UrlService,
  AddFundsLink,
  buttonVariants
};

export function TrialDeploymentBadge({ createdHeight, trialDurationHours = 24, averageBlockTime = 6, className, dependencies: d = DEPENDENCIES }: Props) {
  const { data: latestBlock } = d.useBlock("latest", {
    refetchInterval: 30000
  });

  const { timeLeft, isExpired } = React.useMemo(() => {
    if (!latestBlock || !createdHeight) {
      return { timeLeft: null, isExpired: false };
    }

    const currentHeight = latestBlock.block.header.height;
    const result = d.calculateTrialTimeRemaining(createdHeight, currentHeight, trialDurationHours, averageBlockTime);
    return { timeLeft: result.timeLeft, isExpired: result.isExpired };
  }, [createdHeight, latestBlock, trialDurationHours, averageBlockTime, d]);

  const timeRemainingText = React.useMemo(() => {
    if (!createdHeight) return null;
    return d.formatTrialTimeRemaining(timeLeft, isExpired);
  }, [timeLeft, isExpired, createdHeight, d]);

  const tooltipContent = React.useMemo(() => {
    if (!createdHeight) {
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="font-medium">Trial Deployment</p>
            <p className="text-xs text-muted-foreground">Trial deployments are automatically closed after {trialDurationHours} hours.</p>
          </div>
          <d.AddFundsLink className={d.cn("w-full hover:no-underline", d.buttonVariants({ variant: "default" }))} href={d.UrlService.payment()}>
            <span className="whitespace-nowrap">Add Funds</span>
            <d.HandCard className="ml-2 text-xs" />
          </d.AddFundsLink>
        </div>
      );
    }

    if (isExpired) {
      return (
        <div className="space-y-2">
          <p className="text-sm">This trial deployment has expired and will be closed automatically.</p>
          <d.AddFundsLink className={d.cn("w-full hover:no-underline", d.buttonVariants({ variant: "default" }))} href={d.UrlService.payment()}>
            <span className="whitespace-nowrap">Add Funds</span>
            <d.HandCard className="ml-2 text-xs" />
          </d.AddFundsLink>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="font-medium">Trial Deployment</p>
          <p className="text-sm text-muted-foreground">
            Time remaining: <span className="font-medium text-primary">{timeRemainingText}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Trial deployments are automatically closed after <span className="font-medium text-primary">{trialDurationHours}</span> hours.
          </p>
          <p className="text-xs">Add funds to activate your account.</p>
        </div>
        <d.AddFundsLink className={d.cn("w-full hover:no-underline", d.buttonVariants({ variant: "default" }))} href={d.UrlService.payment()}>
          <span className="whitespace-nowrap">Add Funds</span>
          <d.HandCard className="ml-2 text-xs" />
        </d.AddFundsLink>
      </div>
    );
  }, [isExpired, timeRemainingText, trialDurationHours, createdHeight, d]);

  return (
    <d.CustomTooltip title={tooltipContent}>
      <div className="inline-flex items-center gap-1">
        <d.Badge variant={isExpired ? "destructive" : "default"} className={d.cn("inline-flex cursor-help items-center gap-1", className)}>
          <span>Trial</span>
          <d.Info className="h-3 w-3" />
        </d.Badge>
      </div>
    </d.CustomTooltip>
  );
}
