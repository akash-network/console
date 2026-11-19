"use client";
import type { FC } from "react";
import { useId } from "react";
import { Button, buttonVariants, Checkbox, Label } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { AddFundsButton } from "@src/components/user/AddFundsButton";
import type { TemplatePublishReadiness } from "@src/types/marketplace-template";
import { COMMUNITY_TEMPLATE_TERMS_SUMMARY, CommunityTemplateTerms } from "../CommunityTemplateTerms/CommunityTemplateTerms";
import { FIX_BELOW_ON_NARROW_SCREENS, PublishChecksList, PublishStatusMark } from "../PublishChecksList/PublishChecksList";
import type { PublishCheckFix, PublishFixLinks, PublishOrganization, PublishRequirementFix } from "../publishReadiness";
import { describePublishRequirement, PUBLISH_CHECK_FIX_LABELS } from "../publishReadiness";

export const DEPENDENCIES = { AddFundsButton };

const ADD_CREDITS_CONTEXT = "template_publish";

export interface PublishReadinessPanelProps {
  readiness: TemplatePublishReadiness;
  organization: PublishOrganization | null;
  isRunning: boolean;
  hasAcceptedTerms: boolean;
  fixLinks: PublishFixLinks;
  supportUrl: string;
  onRunAgain: () => void;
  onAcceptedTermsChange: (hasAccepted: boolean) => void;
  onVerifyEmail: () => void;
  onCreditsAdded: () => void;
  onFollowFix: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const PublishReadinessPanel: FC<PublishReadinessPanelProps> = ({
  readiness,
  organization,
  isRunning,
  hasAcceptedTerms,
  fixLinks,
  supportUrl,
  onRunAgain,
  onAcceptedTermsChange,
  onVerifyEmail,
  onCreditsAdded,
  onFollowFix,
  dependencies: d = DEPENDENCIES
}) => {
  const requirementsId = useId();
  const checksId = useId();
  const termsId = useId();

  const renderRequirementFix = (fix: PublishRequirementFix) => {
    if (fix === "verify-email") {
      return (
        <Button type="button" variant="outline" size="sm" onClick={onVerifyEmail}>
          Verify email
        </Button>
      );
    }
    if (fix === "add-credits") {
      return (
        <d.AddFundsButton type="button" variant="outline" size="sm" request={{ context: ADD_CREDITS_CONTEXT, suggestFirstDeployment: false, onCreditsAdded }}>
          Add credits
        </d.AddFundsButton>
      );
    }
    return (
      <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Contact support
      </a>
    );
  };

  const renderCheckFix = (fix: PublishCheckFix) => {
    const href = fixLinks[fix];
    if (!href) return null;

    return (
      <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })} onClick={onFollowFix}>
        {PUBLISH_CHECK_FIX_LABELS[fix]}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby={requirementsId} className="flex flex-col gap-2">
        <h3 id={requirementsId} className="text-sm font-semibold">
          Before you can make it public
        </h3>
        <ul aria-labelledby={requirementsId} className="divide-y divide-border rounded-xl border border-border bg-card">
          {readiness.requirements.map(requirement => {
            const copy = describePublishRequirement(requirement, organization);
            return (
              <li key={requirement.key} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                <PublishStatusMark isMet={requirement.met} metLabel="Met" unmetLabel="Not met" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{copy.label}</p>
                  {!requirement.met && <p className="break-words text-[13px] text-muted-foreground">{copy.help}</p>}
                </div>
                {!requirement.met && copy.fix && <div className={cn("shrink-0", FIX_BELOW_ON_NARROW_SCREENS)}>{renderRequirementFix(copy.fix)}</div>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={checksId} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 id={checksId} className="text-sm font-semibold">
            Publish checks
          </h3>
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {isRunning ? (
              "Running the checks…"
            ) : (
              <>
                Ran {formatDistanceToNowStrict(new Date(readiness.ranAt), { addSuffix: true })} ·{" "}
                <button type="button" className="underline underline-offset-[3px] hover:text-foreground" onClick={onRunAgain}>
                  Run again
                </button>
              </>
            )}
          </p>
        </div>
        <PublishChecksList checks={readiness.checks} renderFix={renderCheckFix} className={cn(isRunning && "opacity-60")} />
      </section>

      <div className="flex items-start gap-2.5">
        <Checkbox id={termsId} className="mt-0.5" checked={hasAcceptedTerms} onCheckedChange={checked => onAcceptedTermsChange(checked === true)} />
        <div className="min-w-0">
          <Label htmlFor={termsId} className="cursor-pointer text-sm font-normal leading-snug">
            I agree to the community template terms: {COMMUNITY_TEMPLATE_TERMS_SUMMARY}.
          </Label>
          <CommunityTemplateTerms version={readiness.termsVersion} />
        </div>
      </div>
    </div>
  );
};
