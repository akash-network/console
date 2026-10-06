"use client";
import React, { useState } from "react";
import { Button, Card, Progress, Skeleton } from "@akashnetwork/ui/components";
import { Clock, Cpu, Lock, Timer } from "lucide-react";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { BONUS_PERCENT, MAX_BONUS } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useTrialStatus } from "./useTrialStatus";

export const DEPENDENCIES = {
  useTrialStatus,
  AddCreditsSheet,
  Button,
  Card,
  Progress,
  Skeleton,
  Clock,
  Cpu,
  Lock,
  Timer
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
    <SettingsSection title="Free trial">
      <d.Card className="rounded-xl p-5 shadow-none sm:px-[22px]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-normal tracking-normal text-muted-foreground">Time left</h3>
          <d.Timer className="h-[17px] w-[17px] shrink-0 text-muted-foreground" aria-hidden />
        </div>

        {trial.daysLeft === null || trial.totalDays === null ? (
          <div className="mt-3 space-y-3.5">
            <d.Skeleton className="h-9 w-40" />
            <d.Skeleton className="h-2.5 w-full" />
          </div>
        ) : (
          <>
            <p className="mt-3 text-[30px] font-bold tabular-nums leading-[1.1] tracking-tight">
              {trial.isExpired ? "Ended" : `${trial.daysLeft} ${trial.daysLeft === 1 ? "day" : "days"}`}
            </p>
            <d.Progress value={trial.daysRemainingPercent} className="mt-3.5 h-2.5 bg-muted" aria-label="Trial days remaining" />
            <p className="mt-2 text-xs text-muted-foreground">
              {trial.isExpired
                ? "Your free trial has ended"
                : `${trial.daysLeft} ${trial.daysLeft === 1 ? "day" : "days"} left out of ${trial.totalDays} days before the trial ends`}
            </p>
          </>
        )}

        <div className="mt-4 space-y-2.5 border-t pt-3.5">
          <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">What the trial limits</p>
          <ul className="space-y-1.5">
            {limitations.map(limitation => (
              <li key={limitation.text} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <span className="mt-px shrink-0" aria-hidden>
                  {limitation.icon}
                </span>
                {limitation.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
          <p className="min-w-0 flex-1 basis-64 text-[13px] text-muted-foreground">
            {`Purchase credits to lift every limit above. Your first purchase earns ${BONUS_PERCENT}% in bonus credits, up to $${MAX_BONUS} free.`}
          </p>
          <d.Button size="sm" onClick={openAddCredits}>
            Purchase credits
          </d.Button>
        </div>
      </d.Card>

      <d.AddCreditsSheet
        open={isAddCreditsOpen}
        onOpenChange={setIsAddCreditsOpen}
        initialTab="purchase"
        description={UNLOCK_SHEET_DESCRIPTION}
        context="billing_trial_panel"
        onDone={closeAddCredits}
      />
    </SettingsSection>
  );

  function openAddCredits() {
    setIsAddCreditsOpen(true);
  }

  function closeAddCredits() {
    setIsAddCreditsOpen(false);
  }
};
