import type { FC, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { Badge, Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CheckIcon } from "lucide-react";

import type { HardwareRequest, TrackerStage } from "../gpuRequestStatus/gpuRequestStatus";
import { describeEndState, describeRequestSummary, describeRequestTitle, describeStatusMessage, describeTracker } from "../gpuRequestStatus/gpuRequestStatus";

const STAGE_STATE_LABELS: Record<TrackerStage["state"], string> = { done: "done", current: "current step", upcoming: "not started" };

type Props = {
  request: HardwareRequest;
  isFocused?: boolean;
  offers?: ReactNode;
  onWithdraw?: () => void;
};

export const GpuRequestCard: FC<Props> = ({ request, isFocused = false, offers, onWithdraw }) => {
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const tracker = describeTracker(request.status);
  const endState = describeEndState(request.status);
  const summary = describeRequestSummary(request);

  useEffect(
    function scrollToTheLinkedRequest() {
      if (isFocused) cardRef.current?.scrollIntoView({ block: "start" });
    },
    [isFocused]
  );

  return (
    <article
      ref={cardRef}
      aria-labelledby={titleId}
      aria-current={isFocused ? "true" : undefined}
      className={cn("rounded-xl border bg-card", isFocused && "ring-2 ring-primary")}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 id={titleId} className="text-base font-semibold">
              {describeRequestTitle(request)}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">
              Sent {new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          {endState && <Badge variant="outline">{endState}</Badge>}
        </div>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        {request.spec && request.details && <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{request.details}</p>}
      </div>
      <div className="flex flex-col gap-3 border-t p-4">
        {tracker && <ProgressTracker stages={tracker} />}
        <p className="text-sm">{describeStatusMessage(request)}</p>
        {offers}
        {onWithdraw && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onWithdraw}>
              Withdraw request
            </Button>
          </div>
        )}
      </div>
    </article>
  );
};

const CONNECTOR_CLASSES: Record<TrackerStage["state"], string> = { done: "bg-foreground", current: "bg-foreground", upcoming: "bg-border" };

const DOT_CLASSES: Record<TrackerStage["state"], string> = {
  done: "border-foreground bg-foreground",
  current: "border-foreground",
  upcoming: "border-border"
};

const DOT_MARKS: Record<TrackerStage["state"], ReactNode> = {
  done: <CheckIcon className="h-2.5 w-2.5 text-background" />,
  current: <span className="h-1.5 w-1.5 rounded-full bg-foreground" />,
  upcoming: null
};

const LABEL_CLASSES: Record<TrackerStage["state"], string> = { done: "", current: "font-semibold", upcoming: "text-muted-foreground" };

function ProgressTracker({ stages }: { stages: TrackerStage[] }) {
  return (
    <ol aria-label="Request progress" className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {stages.map(stage => (
        <li key={stage.status} aria-current={stage.state === "current" ? "step" : undefined} className="group flex items-center gap-2">
          <span aria-hidden="true" className={cn("h-0.5 w-6 rounded-full group-first:hidden", CONNECTOR_CLASSES[stage.state])} />
          <span aria-hidden="true" className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", DOT_CLASSES[stage.state])}>
            {DOT_MARKS[stage.state]}
          </span>
          <span className={cn("text-xs", LABEL_CLASSES[stage.state])}>
            {stage.label}
            <span className="sr-only"> ({STAGE_STATE_LABELS[stage.state]})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
