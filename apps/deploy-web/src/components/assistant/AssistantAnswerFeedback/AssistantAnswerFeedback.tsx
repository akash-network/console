"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";

import type { AssistantTurnRating } from "@src/types/assistant";
import { ReportProblemDialog } from "../ReportProblemDialog/ReportProblemDialog";
import type { AssistantRatableMessage } from "../transcriptModel/transcriptModel";

export const DEPENDENCIES = { ReportProblemDialog };

type Props = {
  message: AssistantRatableMessage;
  onRate: (rating: AssistantTurnRating) => void;
  onReport: (note: string) => Promise<void>;
  dependencies?: typeof DEPENDENCIES;
};

export const AssistantAnswerFeedback: FC<Props> = ({ message, onRate, onReport, dependencies: d = DEPENDENCIES }) => {
  const [isReporting, setIsReporting] = useState(false);
  const isRatedDown = message.rating === "down";
  const toggle = (rating: Exclude<AssistantTurnRating, null>) => onRate(message.rating === rating ? null : rating);
  const openReport = () => setIsReporting(true);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Good answer"
          aria-pressed={message.rating === "up"}
          className="aria-pressed:text-foreground"
          disabled={message.isRating}
          onClick={() => toggle("up")}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" fill={message.rating === "up" ? "currentColor" : "none"} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Bad answer"
          aria-pressed={isRatedDown}
          className="aria-pressed:text-foreground"
          disabled={message.isRating}
          onClick={() => toggle("down")}
        >
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" fill={isRatedDown ? "currentColor" : "none"} />
        </Button>
        {message.reported ? (
          <p role="status" className="ml-1 text-xs">
            Reported. Thanks for telling us.
          </p>
        ) : (
          !isRatedDown && (
            <Button type="button" variant="ghost" size="xs" className="gap-1.5 text-xs" onClick={openReport}>
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              Report a problem
            </Button>
          )
        )}
      </div>

      {isRatedDown && !message.reported && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sorry this answer missed. Want to tell the team what went wrong?
          <Button type="button" variant="outline" size="xs" className="gap-1.5" onClick={openReport}>
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            Report a problem
          </Button>
        </div>
      )}

      {isReporting && <d.ReportProblemDialog onSend={onReport} onClose={() => setIsReporting(false)} />}
    </div>
  );
};
