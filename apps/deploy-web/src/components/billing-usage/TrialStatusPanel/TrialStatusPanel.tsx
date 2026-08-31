"use client";
import React, { useState } from "react";
import { Button, Card, CardContent, CardHeader, Progress } from "@akashnetwork/ui/components";
import { Clock, Cpu, ShieldCheck } from "iconoir-react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { BONUS_PERCENT, MAX_BONUS } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { useTrialStatus } from "./useTrialStatus";

export const DEPENDENCIES = {
  useTrialStatus,
  AddCreditsSheet,
  Button,
  Card,
  CardContent,
  CardHeader,
  Progress,
  Clock,
  Cpu,
  ShieldCheck
};

const UNLOCK_SHEET_DESCRIPTION = "Purchase credits to unlock GPUs, unlimited runtime, and the full Console.";

export const TrialStatusPanel: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const trial = d.useTrialStatus();
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);

  if (!trial.isTrialing) return null;

  const limitations = [
    { icon: <d.Clock className="h-4 w-4 text-muted-foreground" />, text: `Deployments close automatically after ${trial.deploymentDurationHours} hours` },
    { icon: <d.Cpu className="h-4 w-4 text-muted-foreground" />, text: "High-end GPUs stay locked, so trials run on CPU" },
    { icon: <d.ShieldCheck className="h-4 w-4 text-muted-foreground" />, text: "Only providers approved for trials can host your workloads" }
  ];

  return (
    <>
      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-lg font-bold leading-none">Free trial</h3>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Trial</span>
        </d.CardHeader>
        <d.CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-2xl font-bold leading-none" aria-label="Trial days remaining">
                {trial.isExpired ? "Your free trial has ended" : trial.daysLeft === null ? "Trial in progress" : `${trial.daysLeft} days left`}
              </span>
              {!trial.isExpired && trial.daysLeft !== null && <span className="text-sm text-muted-foreground">{`of your ${trial.totalDays} day trial`}</span>}
            </div>
            <d.Progress value={trial.isExpired ? 100 : trial.daysElapsedPercent} className="h-2" aria-label="Trial progress" />
          </div>

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
