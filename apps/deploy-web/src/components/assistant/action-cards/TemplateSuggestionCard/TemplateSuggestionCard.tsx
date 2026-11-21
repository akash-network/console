"use client";
import type { FC, ReactNode } from "react";
import { Button, buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight, BadgeCheck, CircleCheck, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { COMMUNITY_CARD_NOTE } from "@src/components/templates/communityGallery/GalleryEntryCard/GalleryEntryCard";
import { PublisherName } from "@src/components/templates/communityGallery/PublisherName/PublisherName";
import { HardwareProfile } from "@src/components/templates/TemplateCard/TemplateCard";
import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { ReadableSuggestedTemplate } from "./useSuggestedTemplate";
import { useSuggestedTemplate } from "./useSuggestedTemplate";

export const DEPENDENCIES = { useSuggestedTemplate };

export const OFFICIAL_TEMPLATE_LABEL = "Official template";
export const UNAVAILABLE_TEMPLATE_MESSAGE = "This template is no longer available.";

const CARD_CLASSES = "flex flex-col gap-3 rounded-xl border bg-card p-4";
const OVERLINE_CLASSES = "font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

export interface TemplateSuggestionCardProps {
  templateId: string;
  template: NonNullable<AssistantActionOf<"open_in_editor">["template"]>;
  decision: ActionCardDecision;
  dependencies?: typeof DEPENDENCIES;
}

/** A template the assistant suggests, described by what Console reads for its id and labelled by whether Akash reviewed it. */
export const TemplateSuggestionCard: FC<TemplateSuggestionCardProps> = ({ templateId, template, decision, dependencies: d = DEPENDENCIES }) => {
  const suggested = d.useSuggestedTemplate(template.source, templateId);

  if (suggested.status === "loading") {
    return (
      <section aria-label="Suggested template" aria-busy="true" className={cn(CARD_CLASSES, "items-center border-border py-6")}>
        <Spinner size="small" />
      </section>
    );
  }

  if (suggested.status === "unavailable") {
    return (
      <section aria-label="Suggested template" className={cn(CARD_CLASSES, "border-border")}>
        <p className="text-sm text-muted-foreground">{UNAVAILABLE_TEMPLATE_MESSAGE}</p>
      </section>
    );
  }

  if (suggested.status === "failed") {
    return (
      <section aria-label="Suggested template" className={cn(CARD_CLASSES, "border-border")}>
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn&apos;t load this template.
        </p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 self-start" onClick={suggested.retry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </section>
    );
  }

  const isReviewedByAkash = template.reviewedByAkash && suggested.isOfficial;

  return (
    <section
      aria-label={`Suggested template: ${suggested.title}`}
      className={cn(CARD_CLASSES, isReviewedByAkash ? "border-border" : "border-amber-500/60 dark:border-amber-400/50")}
    >
      {isReviewedByAkash ? (
        <TrustLabel className="text-blue-600 dark:text-blue-400" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
          {OFFICIAL_TEMPLATE_LABEL}
        </TrustLabel>
      ) : (
        <TrustLabel className="text-amber-700 dark:text-amber-400" icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}>
          {COMMUNITY_CARD_NOTE}
        </TrustLabel>
      )}

      <TemplateIdentity suggested={suggested} />
      <TemplateSummary summary={suggested.summary} isQuoted={!isReviewedByAkash} />

      {suggested.hardware && (
        <div className="border-t pt-3">
          <HardwareProfile hardware={suggested.hardware} />
        </div>
      )}

      {decision.status === "succeeded" && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
          Opened.
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2">
        {suggested.viewUrl && (
          <Link href={suggested.viewUrl} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View template
          </Link>
        )}
        <Link
          href={suggested.configureUrl}
          onClick={decision.markOpened}
          className={cn(buttonVariants({ variant: isReviewedByAkash ? "default" : "outline", size: "sm" }), "gap-1.5")}
        >
          Deploy
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </section>
  );
};

const TrustLabel: FC<{ icon: ReactNode; className: string; children: ReactNode }> = ({ icon, className, children }) => (
  <p className={cn("flex items-center gap-1.5 text-[12.5px] font-medium", className)}>
    {icon}
    {children}
  </p>
);

const TemplateIdentity: FC<{ suggested: ReadableSuggestedTemplate }> = ({ suggested }) => (
  <div className="flex min-w-0 items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
      <TemplateIcon icon={suggested.icon} className="h-4 w-4" />
    </span>
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="break-words text-sm font-semibold leading-tight">{suggested.title}</h3>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted-foreground">
        {suggested.publisher && <PublisherName name={suggested.publisher.name} verified={suggested.publisher.verified} />}
        {suggested.facts.map(fact => (
          <span key={fact}>· {fact}</span>
        ))}
      </p>
    </div>
  </div>
);

const TemplateSummary: FC<{ summary: string | null; isQuoted: boolean }> = ({ summary, isQuoted }) => {
  if (!summary) return null;
  if (!isQuoted) return <p className="break-words text-[13px] text-muted-foreground">{summary}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className={OVERLINE_CLASSES}>Publisher&apos;s description, quoted as written</p>
      <blockquote className="break-words rounded-md border-l-2 border-border bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">“{summary}”</blockquote>
    </div>
  );
};
