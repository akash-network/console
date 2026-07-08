"use client";
import type { FC } from "react";

import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useAutoDeploymentFlow } from "@src/hooks/useAutoDeploymentFlow/useAutoDeploymentFlow";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { PhasedDeployProgressScene } from "../DeployProgressOverlay/PhasedDeployProgressScene";

export const DEPENDENCIES = {
  Layout,
  PhasedDeployProgressScene,
  useEnsureTrialStarted,
  useAutoDeploymentFlow,
  useServices
};

type Props = {
  /** Display name shown in the progress panel ("Deploying {templateName}"). */
  templateName: string;
  /** The resolved SDL to deploy, already derived from the intent's template on the configure screen. */
  sdl: string;
  /** The template the flow deploys; mirrored into the flow's intent so a URL resume preserves it. */
  templateId?: string;
  /** The deployment's dseq when resuming (a reload of the progress view); absent on a fresh start. */
  dseq?: string;
  /** The active configure draft id, preserved in the URL when the created dseq is written so a reload resolves the same session. */
  draftId?: string;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The auto-deploy experience of the bid-screening view: when the configure intent is `sdl-strategy=default` +
 * `bid-strategy=auto`, the screen skips the manual form and drives the deployment automatically through the
 * globe + phased progress panel (create deployment → matching providers → preparing), then redirects to the
 * deployment details. Trial readiness is ensured here (mirroring the onboarding picker) so the flow can wait
 * on the trial wallet spinning up before broadcasting. Rendered only in the auto branch so the trial is never
 * auto-started for manual configure visitors.
 *
 * The created deployment's dseq is written into the URL by the underlying `useDeploymentFlow` state machine (the
 * phased flow autopilots over it), so a reload resumes the same deployment — picking up at matching, or at
 * preparing if a lease already exists — instead of creating a new one. Deploy-success navigation is likewise owned
 * by that flow's built-in redirect.
 */
export const AutoDeployFlow: FC<Props> = ({ templateName, sdl, templateId, dseq, draftId, dependencies: d = DEPENDENCIES }) => {
  const { isWalletReady, error: trialError } = d.useEnsureTrialStarted();
  const { publicConfig } = d.useServices();
  const { state, progressPercent, phases, matchedProviderAddress, tryAgain } = d.useAutoDeploymentFlow({
    sdl,
    isWalletReady,
    trialError,
    initialDseq: dseq,
    templateId,
    draftId
  });

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col dark:bg-card">
      <d.PhasedDeployProgressScene
        templateName={templateName}
        state={state}
        progressPercent={progressPercent}
        phases={phases}
        focusedProviderAddress={matchedProviderAddress}
        onTryAgain={tryAgain}
        onContactSupport={() => {
          window.open(publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL, "_blank", "noopener,noreferrer");
        }}
      />
    </d.Layout>
  );
};
