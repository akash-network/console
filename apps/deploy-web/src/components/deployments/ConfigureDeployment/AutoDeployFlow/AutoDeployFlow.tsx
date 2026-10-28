"use client";
import type { FC } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import Layout from "@src/components/layout/Layout";
import { budgetAccessFor } from "@src/components/projects/projectSpend";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import type { DeployProgressState } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { useAutoDeploymentFlow } from "@src/hooks/useAutoDeploymentFlow/useAutoDeploymentFlow";
import { UrlService } from "@src/utils/urlUtils";
import { PhasedDeployProgressScene } from "../DeployProgressOverlay/PhasedDeployProgressScene";
import type { ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useLandOnDeploymentList } from "../useLandOnDeploymentList/useLandOnDeploymentList";
import { useResumeAfterCredits } from "../useResumeAfterCredits/useResumeAfterCredits";

export const DEPENDENCIES = {
  Layout,
  PhasedDeployProgressScene,
  useAutoDeploymentFlow,
  useServices,
  useAddCredits,
  useActiveOrganization,
  useRouter,
  useLandOnDeploymentList
};

const NEEDS_FUNDS_CONTEXT = "auto_deploy_needs_funds";

type Props = {
  /** Display name shown in the progress panel ("Deploying {templateName}"). */
  templateName: string;
  /** The resolved SDL to deploy, already derived from the intent's template on the configure screen. */
  sdl: string;
  /** The resume resolution from the {@link ResumeDeploymentGuard}: any live leases to reconstruct so the manifest re-sends. */
  resume: ResumeResolution;
  /** The shared base flow, created once by the `DeploymentFlowProvider` (seeded from the resolved intent, including a resumed dseq). */
  flow: DeploymentFlow;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The auto-deploy experience of the bid-screening view: when the configure intent is `sdl-strategy=default` +
 * `bid-strategy=auto`, the screen skips the manual form and drives the deployment automatically through the
 * globe + phased progress panel (create deployment → matching providers → preparing), then lands on the deployments
 * list once the api takes the lease on, or on the deployment when the lease is created during the request. The base flow comes from the `DeploymentFlowProvider` (shared with the manual branch), so this
 * component only autopilots over it. Spend-readiness is enforced server-side: a create against a still-provisioning
 * trial wallet gets a retriable 409, which the create mutation retries until activation lands.
 *
 * The created deployment's dseq is written into the URL by the underlying `useDeploymentFlow` state machine (the
 * phased flow autopilots over it), so a reload resumes the same deployment — picking up at matching, or at
 * preparing if a lease already exists — instead of creating a new one. Deploy-success navigation is likewise owned
 * by that flow's built-in redirect.
 */
export const AutoDeployFlow: FC<Props> = ({ templateName, sdl, resume, flow, dependencies: d = DEPENDENCIES }) => {
  const { publicConfig, analyticsService } = d.useServices();
  const openAddCredits = d.useAddCredits();
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const router = d.useRouter();
  const { state, progressPercent, phases, matchedProviderAddress, tryAgain, stopAutopilot } = d.useAutoDeploymentFlow({
    sdl,
    resumeLeases: resume.activeLeases,
    flow
  });
  const refusingProjectId = budgetRefusingProjectIdOf(state);
  const canOpenProjectBudget = projectsEnabled && budgetAccessFor(activeOrganization?.role, undefined).canManage;
  const tryAgainAfterCredits = useResumeAfterCredits({
    isRefusedForFunds: state.kind === "error" && state.reason === "needs-funds",
    resume: () => {
      analyticsService.track("add_credits_resumed_deploy", { category: "billing", context: NEEDS_FUNDS_CONTEXT });
      tryAgain();
    }
  });
  d.useLandOnDeploymentList(flow.autoLeasedDseq);

  /** Halts the autopilot first, since the bid-strategy change only unmounts this flow once the URL propagates. */
  function handOffToManualPick() {
    stopAutopilot();
    flow.actions.setBidStrategy("select");
  }

  if (isStartingInBackground(flow, state)) {
    return (
      <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Spinner size="large" />
          <h1 className="text-lg font-semibold">Starting your deployment</h1>
        </div>
      </d.Layout>
    );
  }

  return (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <d.PhasedDeployProgressScene
        templateName={templateName}
        state={state}
        progressPercent={progressPercent}
        phases={phases}
        focusedProviderAddress={matchedProviderAddress}
        onTryAgain={tryAgain}
        onTryAnotherProvider={handOffToManualPick}
        onAddFunds={() => {
          openAddCredits({
            initialTab: "purchase",
            description: `Add credits to your balance to deploy ${templateName}.`,
            context: NEEDS_FUNDS_CONTEXT,
            nextStepLabel: "Continue to deploy",
            onCreditsAdded: tryAgainAfterCredits
          });
        }}
        onViewProject={refusingProjectId && canOpenProjectBudget ? () => router.push(UrlService.project(refusingProjectId)) : undefined}
        onContactSupport={() => {
          window.open(publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL, "_blank", "noopener,noreferrer");
        }}
        onChooseProvider={() => {
          analyticsService.track("onboarding_choose_provider_click", { category: "onboarding", templateName });
          handOffToManualPick();
        }}
      />
    </d.Layout>
  );
};

/** The api usually takes a one-click deploy on whole, so the globe waits for a create it answered without doing so, or for a refusal to show. */
function isStartingInBackground(flow: DeploymentFlow, state: DeployProgressState): boolean {
  return !!flow.autoLeasedDseq || (state.kind === "creating" && !flow.isCreatingInBackground);
}

function budgetRefusingProjectIdOf(state: DeployProgressState): string | undefined {
  return state.kind === "error" && state.reason === "budget-exceeded" ? state.projectId : undefined;
}
