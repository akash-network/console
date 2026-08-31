"use client";
import React, { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Progress, Skeleton } from "@akashnetwork/ui/components";
import { Clock, Cpu, Lock } from "iconoir-react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { BONUS_PERCENT, MAX_BONUS } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { useTrialStatus } from "./useTrialStatus";

export const DEPENDENCIES = {
  useTrialStatus,
  AddCreditsSheet,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Progress,
  Skeleton,
  Clock,
  Cpu,
  Lock
};

const UNLOCK_SHEET_DESCRIPTION = "Purchase credits to unlock GPUs, unlimited runtime, and the full Console.";

export const TrialStatusPanel: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const trial = d.useTrialStatus();
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);

  if (!trial.isTrialing) return null;

  const limitations = [
    { icon: <d.Clock className="h-4 w-4 text-muted-foreground" />, text: `Deployments close automatically after ${trial.deploymentDurationHours} hours` },
    { icon: <d.Cpu className="h-4 w-4 text-muted-foreground" />, text: "High-end GPUs are locked, though lower-end GPUs stay available" },
    { icon: <d.Lock className="h-4 w-4 text-muted-foreground" />, text: "GPU interconnect and GPU-backed confidential compute are unavailable" }
  ];

  return (
    <>
      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-lg font-bold leading-none">Free trial</h3>
          <d.Badge variant="info">Trial</d.Badge>
        </d.CardHeader>
        <d.CardContent className="space-y-4">
          {trial.daysLeft === null || trial.totalDays === null ? (
            <div className="space-y-2">
              <d.Skeleton className="h-2 w-full" />
              <d.Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <div className="space-y-2">
              <d.Progress value={trial.daysRemainingPercent} className="h-2" aria-label="Trial days remaining" />
              <p className="text-sm text-muted-foreground">
                {trial.isExpired
                  ? "Your free trial has ended"
                  : `${trial.daysLeft} ${trial.daysLeft === 1 ? "day" : "days"} left out of ${trial.totalDays} days before the trial ends`}
              </p>
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">What the trial limits</p>
            <ul className="space-y-1.5">
              {limitations.map(limitation => (
                <li key={limitation.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0" aria-hidden>
                    {limitation.icon}
                  </span>
                  {limitation.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {`Purchase credits to lift every limit above. Your first purchase earns ${BONUS_PERCENT}% in bonus credits, up to $${MAX_BONUS} free.`}
            </p>
            <d.Button onClick={openAddCredits}>Purchase credits</d.Button>
          </div>
        </d.CardContent>
      </d.Card>

      <d.AddCreditsSheet
        open={isAddCreditsOpen}
        onOpenChange={setIsAddCreditsOpen}
        initialTab="purchase"
        description={UNLOCK_SHEET_DESCRIPTION}
        context="billing_trial_panel"
        onDone={closeAddCredits}
      />
    </>
  );

  function openAddCredits() {
    setIsAddCreditsOpen(true);
  }

  function closeAddCredits() {
    setIsAddCreditsOpen(false);
  }
};
