"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { Button, LoadingButton, Textarea, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";
import { Angry, CircleCheck, Frown, Laugh, Meh, Send, Smile, TriangleAlert, X } from "lucide-react";

import type { DeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import { FeedbackConsentNote } from "../FeedbackConsentNote/FeedbackConsentNote";

export const MAX_FEEDBACK_MESSAGE_LENGTH = 4000;

const RATINGS = [
  { value: 1, label: "Frustrating", Icon: Angry },
  { value: 2, label: "Not great", Icon: Frown },
  { value: 3, label: "Okay", Icon: Meh },
  { value: 4, label: "Good", Icon: Smile },
  { value: 5, label: "Great", Icon: Laugh }
];

const COPY: Record<DeploymentOutcome, { status: string; subtitle: string; placeholder: string }> = {
  live: {
    status: "Deployment live",
    subtitle: "Your read on this helps us decide what to refine next.",
    placeholder: "What stood out, good or bad?"
  },
  failed: {
    status: "Deployment failed",
    subtitle: "Sorry this one didn't ship. Tell us where it broke down.",
    placeholder: "What went wrong, or where did you get stuck?"
  }
};

export type DeploymentOutcomeAnswer = { rating: number; message?: string };

type Props = {
  outcome: DeploymentOutcome;
  deploymentName?: string;
  isSending: boolean;
  onSend: (answer: DeploymentOutcomeAnswer) => void;
  onDismiss: () => void;
};

export const DeploymentOutcomeCard: FC<Props> = ({ outcome, deploymentName, isSending, onSend, onDismiss }) => {
  const [rating, setRating] = useState<number>();
  const [message, setMessage] = useState("");
  const titleId = useId();
  const copy = COPY[outcome];
  const StatusIcon = outcome === "live" ? CircleCheck : TriangleAlert;

  const send = () => {
    if (rating) onSend({ rating, message: message.trim() || undefined });
  };

  return (
    <section
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border bg-card p-5 text-card-foreground shadow-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <StatusIcon className="h-4 w-4" aria-hidden />
          {copy.status}
        </p>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8" aria-label="Close" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <h2 id={titleId} className="mt-2 text-lg font-semibold leading-snug">
        {deploymentName ? `How was deploying ${deploymentName}?` : "How was your deploy?"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

      <ToggleGroup
        type="single"
        role="radiogroup"
        aria-label="Rating"
        variant="outline"
        className="mt-4 grid grid-cols-5 gap-2"
        value={rating ? String(rating) : ""}
        onValueChange={value => value && setRating(Number(value))}
      >
        {RATINGS.map(({ value, label, Icon }) => (
          <ToggleGroupItem
            key={value}
            value={String(value)}
            aria-label={label}
            className="h-14 rounded-xl data-[state=on]:border-foreground data-[state=on]:bg-accent"
          >
            <Icon className="h-6 w-6" aria-hidden />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="mt-2 flex justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-hidden>
        <span>{RATINGS[0].label}</span>
        <span>{RATINGS[RATINGS.length - 1].label}</span>
      </div>

      <Textarea
        className="mt-4"
        inputClassName="min-h-20 rounded-xl"
        aria-label="Tell us more"
        placeholder={`${copy.placeholder} (optional)`}
        maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
        rows={3}
        value={message}
        onChange={event => setMessage(event.target.value)}
      />

      <div className="mt-3">
        <FeedbackConsentNote sentWith="this deployment's details" />
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={onDismiss} disabled={isSending}>
          Not now
        </Button>
        <LoadingButton className="w-full sm:w-auto" loading={isSending} disabled={!rating} onClick={send}>
          Send feedback
          <Send className="ml-2 h-4 w-4" aria-hidden />
        </LoadingButton>
      </div>
    </section>
  );
};
