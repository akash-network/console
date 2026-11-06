"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { Button, Checkbox, LoadingButton } from "@akashnetwork/ui/components";
import { Check, Hash, Sparkles } from "lucide-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";
import { ASSISTANT_CONSENT_COPY } from "../assistantConsentCopy";

const POINT_ICONS = [Sparkles, Check, Hash];

type Props = {
  isSaving: boolean;
  hasFailed: boolean;
  onAgree: (input: { reviewOptIn: boolean }) => void;
  onDecline: () => void;
};

export const AssistantConsentCard: FC<Props> = ({ isSaving, hasFailed, onAgree, onDecline }) => {
  const reviewOptInId = useId();
  const [reviewOptIn, setReviewOptIn] = useState(false);

  return (
    <section aria-labelledby={`${reviewOptInId}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={`${reviewOptInId}-title`} className="text-lg font-semibold">
          {ASSISTANT_CONSENT_COPY.title}
        </h3>
        <p className="text-sm text-muted-foreground">{ASSISTANT_CONSENT_COPY.intro}</p>
      </div>

      <ul className="flex flex-col gap-3 text-sm">
        {ASSISTANT_CONSENT_COPY.points.map((point, index) => {
          const Icon = POINT_ICONS[index];
          return (
            <li key={point} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {point}
            </li>
          );
        })}
      </ul>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
        <Checkbox id={reviewOptInId} checked={reviewOptIn} onCheckedChange={checked => setReviewOptIn(checked === true)} className="mt-0.5" />
        <div className="flex flex-col gap-1">
          <label htmlFor={reviewOptInId} className="text-sm font-semibold leading-5">
            {ASSISTANT_CONSENT_COPY.reviewOptInLabel}
          </label>
          <p className="text-xs text-muted-foreground">{ASSISTANT_CONSENT_COPY.reviewOptInDescription}</p>
        </div>
      </div>

      {hasFailed && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t save your choice. Try again.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={UrlService.privacyPolicy()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Privacy policy
        </Link>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDecline}>
            Not now
          </Button>
          <LoadingButton type="button" size="sm" loading={isSaving} onClick={() => onAgree({ reviewOptIn })}>
            Agree and start
          </LoadingButton>
        </div>
      </div>
    </section>
  );
};
