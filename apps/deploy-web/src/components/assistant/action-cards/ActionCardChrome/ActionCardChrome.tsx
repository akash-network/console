"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button, buttonVariants, Input, LoadingButton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import Link from "next/link";

import type { AssistantAction } from "@src/types/assistant";
import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardDecision, ActionCardOutcome } from "../useActionCardDecision/useActionCardDecision";

export interface ActionCardRow {
  label: string;
  value: ReactNode;
}

export interface ActionCardDiff {
  removed: string[];
  added: string[];
  unchanged?: string;
}

export interface ActionCardDeepLink {
  href: string;
  label: string;
}

export interface ActionCardChromeProps {
  title: string;
  /** A short tag at the top right, such as the service the card changes. */
  scope?: string;
  tier: AssistantAction["tier"];
  decision: ActionCardDecision;
  rows?: ActionCardRow[];
  diff?: ActionCardDiff;
  costNote?: string;
  irreversibleNote?: string;
  confirmLabel?: string;
  /** Required for a `deep_link` card: Confirm becomes a link that opens the page, prefilled. */
  deepLink?: ActionCardDeepLink;
  /** Asked before a destructive card can be confirmed, as the regular UI asks for it. */
  reasonLabel?: string;
  successMessage?: string;
  /** Run on Confirm with the typed reason, if any; throws to show the error in the card. */
  onConfirm?: (reason: string) => Promise<ActionCardOutcome | void>;
  isConfirmDisabled?: boolean;
  children?: ReactNode;
}

const DEFAULT_SUCCESS_MESSAGE = "Done.";

export const ActionCardChrome: FC<ActionCardChromeProps> = ({
  title,
  scope,
  tier,
  decision,
  rows = [],
  diff,
  costNote,
  irreversibleNote,
  confirmLabel = "Confirm",
  deepLink,
  reasonLabel,
  successMessage = DEFAULT_SUCCESS_MESSAGE,
  onConfirm,
  isConfirmDisabled,
  children
}) => {
  const [reason, setReason] = useState("");
  const isDestructive = tier === "destructive";
  const isMissingReason = !!reasonLabel && reason.trim().length === 0;
  const isSettled = decision.status === "succeeded" || decision.status === "cancelled";

  return (
    <section
      aria-label={title}
      data-tier={tier}
      className="flex flex-col gap-3 rounded-xl border border-primary/60 bg-card p-4 data-[tier=destructive]:border-destructive/60"
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {scope && <span className="shrink-0 font-mono text-xs text-muted-foreground">{scope}</span>}
      </header>

      {diff && <DiffBlock diff={diff} />}

      {rows.length > 0 && (
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map(row => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium [overflow-wrap:anywhere]">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {(costNote || irreversibleNote) && (
        <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          {costNote && <p>{costNote}</p>}
          {irreversibleNote && <p className="font-medium text-destructive">{irreversibleNote}</p>}
        </div>
      )}

      {isDestructive && reasonLabel && !isSettled && (
        <Input label={reasonLabel} value={reason} onChange={event => setReason(event.target.value)} disabled={decision.status === "running"} />
      )}

      {decision.status === "failed" && decision.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {decision.error}
        </p>
      )}

      {decision.status === "succeeded" && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
          {deepLink ? "Opened." : successMessage}
        </p>
      )}

      {decision.status === "succeeded" && decision.deploymentDseq && (
        <Link
          href={UrlService.deploymentDetails(decision.deploymentDseq)}
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          View deployment
        </Link>
      )}

      {decision.status === "cancelled" && (
        <p role="status" className="text-sm text-muted-foreground">
          Cancelled.
        </p>
      )}

      {!isSettled && (
        <footer className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={decision.cancel} disabled={decision.status === "running"}>
            Cancel
          </Button>
          {deepLink ? (
            <Link href={deepLink.href} onClick={decision.markOpened} className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}>
              {deepLink.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            onConfirm && (
              <LoadingButton
                type="button"
                size="sm"
                variant={isDestructive ? "destructive" : "default"}
                loading={decision.status === "running"}
                disabled={isConfirmDisabled || isMissingReason}
                onClick={() => decision.confirm(() => onConfirm(reason.trim()))}
              >
                {decision.status === "failed" ? "Try again" : confirmLabel}
              </LoadingButton>
            )
          )}
        </footer>
      )}
    </section>
  );
};

const DiffBlock: FC<{ diff: ActionCardDiff }> = ({ diff }) => (
  <div className="overflow-hidden rounded-md border bg-muted font-mono text-xs" aria-label="Changes">
    {diff.removed.map(line => (
      <p key={`removed-${line}`} className="bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-400">
        <span aria-hidden="true">- </span>
        <span className="sr-only">Before: </span>
        {line}
      </p>
    ))}
    {diff.added.map(line => (
      <p key={`added-${line}`} className="bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
        <span aria-hidden="true">+ </span>
        <span className="sr-only">After: </span>
        {line}
      </p>
    ))}
    {diff.unchanged && <p className="px-3 py-1.5 text-muted-foreground">{diff.unchanged}</p>}
  </div>
);
