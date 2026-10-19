"use client";
import type { FC, MouseEvent } from "react";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useIsKnownNotOnboarded } from "@src/hooks/useIsKnownNotOnboarded";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import { DiscardDeploymentDialog } from "../../DiscardDeploymentDialog/DiscardDeploymentDialog";
import type { DeploymentIntent } from "../../useDeploymentFlow/deploymentIntent";

export const DEPENDENCIES = { useRouter, useIsKnownNotOnboarded, useServices, UrlService };

type Props = {
  intent: Pick<DeploymentIntent, "templateId" | "userTemplateId">;
  needsConfirmation: boolean;
  deploymentName: string;
  serviceCount: number;
  placementCount: number;
  hasBids: boolean;
  canEditInstead: boolean;
  onDiscard: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** Leaving after a discard replaces the entry instead of pushing one, so the browser's back button never returns to the closed deployment. */
export const LeaveConfigureButton: FC<Props> = ({
  intent,
  needsConfirmation,
  deploymentName,
  serviceCount,
  placementCount,
  hasBids,
  canEditInstead,
  onDiscard,
  dependencies: d = DEPENDENCIES
}) => {
  const router = d.useRouter();
  const isKnownNotOnboarded = d.useIsKnownNotOnboarded();
  const { analyticsService } = d.useServices();
  const [isConfirming, setIsConfirming] = useState(false);
  const destination = destinationFor(intent, isKnownNotOnboarded, d.UrlService);

  function confirmBeforeLeaving(event: MouseEvent<HTMLAnchorElement>) {
    if (isOpeningElsewhere(event)) return;
    if (!needsConfirmation) {
      trackLeavingOnboarding(false);
      return;
    }
    event.preventDefault();
    setIsConfirming(true);
  }

  function discardAndLeave() {
    onDiscard();
    trackLeavingOnboarding(true);
    setIsConfirming(false);
    router.replace(destination.href);
  }

  function trackLeavingOnboarding(discardedDeployment: boolean) {
    if (!isKnownNotOnboarded) return;
    analyticsService.track("onboarding_left", { category: "onboarding", control: "back_link", discardedDeployment });
  }

  return (
    <>
      <Link
        href={destination.href}
        onClick={confirmBeforeLeaving}
        className="inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {destination.label}
      </Link>
      <DiscardDeploymentDialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title="Leave and discard this deployment?"
        description="Leaving closes the pending deployment and discards this draft. You'll lose:"
        keepLabel="Keep configuring"
        discardLabel="Discard and leave"
        onDiscard={discardAndLeave}
      >
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            {deploymentName || "Your deployment"}, with {serviceCount} {serviceCount === 1 ? "service" : "services"} across {placementCount}{" "}
            {placementCount === 1 ? "placement" : "placements"}
          </li>
          {hasBids && <li>The bids providers have sent so far</li>}
        </ul>
        {canEditInstead && <p className="text-sm text-muted-foreground">To change the configuration instead, use Edit.</p>}
      </DiscardDeploymentDialog>
    </>
  );
};

/** A user who has not onboarded yet goes to the onboarding picker directly, since the onboarding gate bounces them there from every other destination. */
function destinationFor(
  { templateId, userTemplateId }: Props["intent"],
  isKnownNotOnboarded: boolean,
  urlService: typeof UrlService
): { href: string; label: string } {
  if (isKnownNotOnboarded) return { href: urlService.onboardingPicker(), label: "Back to onboarding" };
  if (templateId && hasGalleryPage(templateId)) return { href: urlService.templateDetails(templateId), label: "Back to template" };
  if (userTemplateId) return { href: urlService.template(userTemplateId), label: "Back to template" };
  return { href: urlService.newDeployment(), label: "Back to deployment types" };
}

function hasGalleryPage(templateId: string): boolean {
  return !hardcodedTemplates.some(template => template.code === templateId);
}

function isOpeningElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
