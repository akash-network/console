"use client";

import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight, Check } from "iconoir-react";
import { capitalize } from "lodash";

type DeploymentPhaseStatus = "pending" | "active" | "completed";

/** Upper bound for `progressPercent` — the bar fills the rounded segment up to 100%. */
const BAR_MAX_PERCENT = 100;

type DeploymentPhase = {
  id: "creating" | "matching" | "preparing";
  label: string;
  status: DeploymentPhaseStatus;
};

type DeployOverlayState = { kind: "creating" | "matching" | "preparing" | "success" } | { kind: "error"; message?: string };

type DeployProgressOverlayProps = {
  state: DeployOverlayState;
  templateName: string;
  progressPercent: number;
  phases: [DeploymentPhase, DeploymentPhase, DeploymentPhase];
  onChooseProvider?: () => void;
  onStartOver?: () => void;
  onContactSupport?: () => void;
};

export function PhasedDeploymentProgress({
  state,
  templateName,
  progressPercent,
  phases,
  onChooseProvider,
  onStartOver,
  onContactSupport
}: DeployProgressOverlayProps) {
  if (state.kind === "error") {
    return <DeployErrorPanel templateName={templateName} message={state.message} onStartOver={onStartOver} onContactSupport={onContactSupport} />;
  }

  return <DeployProgressPanel templateName={templateName} progressPercent={progressPercent} phases={phases} onChooseProvider={onChooseProvider} />;
}

type DeployErrorPanelProps = {
  templateName: string;
  message?: string;
  onStartOver?: () => void;
  onContactSupport?: () => void;
};

function DeployErrorPanel({ templateName, message, onStartOver, onContactSupport }: DeployErrorPanelProps) {
  return (
    <div className="relative z-10 flex w-full flex-col gap-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-9 text-foreground">We couldn&apos;t deploy {templateName}</h1>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            {message ??
              "Something went wrong while creating your deployment. You can try again from the start, or contact support if the problem keeps happening."}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onStartOver}>Start over</Button>
          <Button variant="outline" onClick={onContactSupport}>
            Contact support
          </Button>
        </div>
      </div>
    </div>
  );
}

type DeployProgressPanelProps = {
  templateName: string;
  progressPercent: number;
  phases: [DeploymentPhase, DeploymentPhase, DeploymentPhase];
  onChooseProvider?: () => void;
};

function DeployProgressPanel({ templateName, progressPercent, phases, onChooseProvider }: DeployProgressPanelProps) {
  const checkpoints = phases.map((phase, i) => ({
    at: ((i + 1) / phases.length) * BAR_MAX_PERCENT,
    status: phase.status
  }));

  return (
    <div className="relative z-10 flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase leading-4 text-muted-foreground">
          <span aria-hidden className="block h-2 w-2 rounded-full bg-green-400" />
          <span>Deploying</span>
        </div>

        <h1 className="text-3xl font-bold leading-9 text-foreground">Deploying {templateName}</h1>

        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
          We&apos;ll pick the best host for you. Typical deploys take 15–30 seconds. When your deployment is ready, we&apos;ll automatically redirect you.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="pr-[11px]">
          <div className="relative h-2 w-full">
            <div className="absolute inset-0 overflow-hidden rounded-full bg-secondary">
              <div
                role="progressbar"
                aria-label="Deploy progress"
                aria-valuemin={0}
                aria-valuemax={BAR_MAX_PERCENT}
                aria-valuenow={Math.round(clampPercent(progressPercent))}
                className="h-full rounded-full bg-primary"
                style={{ width: `${clampPercent(progressPercent)}%` }}
              />
            </div>

            {checkpoints.map(({ at, status }, i) => (
              <ProgressCheckpoint key={i} at={at} status={status} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3">
          {phases.map(phase => (
            <p
              key={phase.id}
              className={cn(
                "text-right text-xs font-medium leading-5",
                phase.status === "pending" && "text-muted-foreground",
                phase.status === "active" && "text-foreground",
                phase.status === "completed" && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {phase.label}
            </p>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-5 text-muted-foreground">Want to choose the provider yourself?</p>

        <Button variant="outline" size="sm" className="w-full gap-2 px-3 text-xs sm:w-auto" onClick={onChooseProvider}>
          <span>Choose my provider</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Single dot rendered on top of the progress bar at the marker position for its phase. Filled + checkmark when completed, hollow + pulsing dot when active, hollow when pending. */
function ProgressCheckpoint({ at, status }: { at: number; status: DeploymentPhaseStatus }) {
  return (
    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at}%` }}>
      <span
        className={cn(
          "relative inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-primary-foreground bg-primary text-primary-foreground",
          status === "completed" ? "border-primary-foreground bg-primary text-primary-foreground" : "border-2 border-border bg-background"
        )}
        aria-label={capitalize(status)}
      >
        {status === "completed" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : (
          <span className={cn("block h-2 w-2 rounded-full bg-foreground", status === "active" && "animate-pulse")} aria-hidden />
        )}
      </span>
    </div>
  );
}

/** Clamp an externally-driven percent to the bar's [0, 100] range so a bug elsewhere can't blow the layout. */
function clampPercent(percent: number) {
  return Math.max(0, Math.min(BAR_MAX_PERCENT, percent));
}
