import type { FC, ReactNode } from "react";
import { Fragment } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Check, X } from "lucide-react";

import type { TemplatePublishCheck } from "@src/types/marketplace-template";
import type { PublishCheckFix } from "../publishReadiness";
import { publishCheckFixesOf, publishCheckLabelOf } from "../publishReadiness";

/** Beside the message, a fix button leaves a phone-wide dialog about 120 px for the text; under the mark and message it gets the full row. */
export const FIX_BELOW_ON_NARROW_SCREENS = "basis-full pl-8 sm:basis-auto sm:pl-0";

const NO_REASON_GIVEN = "This check didn't pass.";

export interface PublishChecksListProps {
  checks: TemplatePublishCheck[];
  renderFix?: (fix: PublishCheckFix) => ReactNode;
  className?: string;
}

export const PublishChecksList: FC<PublishChecksListProps> = ({ checks, renderFix, className }) => (
  <ul aria-label="Publish checks" className={cn("divide-y divide-border rounded-xl border border-border bg-card", className)}>
    {checks.map(check => (
      <PublishCheckRow key={check.key} check={check} renderFix={renderFix} />
    ))}
  </ul>
);

const PublishCheckRow: FC<{ check: TemplatePublishCheck; renderFix: PublishChecksListProps["renderFix"] }> = ({ check, renderFix }) => {
  const hasPassed = check.status === "passed";
  const reasons = check.issues.length > 0 ? check.issues.map(issue => issue.message) : [NO_REASON_GIVEN];
  const fixes = renderFix ? publishCheckFixesOf(check) : [];

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <PublishStatusMark isMet={hasPassed} metLabel="Passed" unmetLabel="Failed" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{publishCheckLabelOf(check.key)}</p>
        {!hasPassed &&
          reasons.map((reason, index) => (
            <p key={index} className="break-words text-[13px] text-destructive">
              {reason}
            </p>
          ))}
      </div>
      {fixes.length > 0 && (
        <div className={cn("flex shrink-0 flex-wrap items-center gap-2", FIX_BELOW_ON_NARROW_SCREENS)}>
          {fixes.map(fix => (
            <Fragment key={fix}>{renderFix?.(fix)}</Fragment>
          ))}
        </div>
      )}
    </li>
  );
};

export const PublishStatusMark: FC<{ isMet: boolean; metLabel: string; unmetLabel: string }> = ({ isMet, metLabel, unmetLabel }) => (
  <span
    className={cn(
      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
      isMet ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
    )}
  >
    {isMet ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
    <span className="sr-only">{isMet ? metLabel : unmetLabel}</span>
  </span>
);
