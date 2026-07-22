"use client";
import type { FC } from "react";
import { useCallback } from "react";

import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useAutoDeploymentFlow } from "@src/hooks/useAutoDeploymentFlow/useAutoDeploymentFlow";
import { PhasedDeployProgressScene } from "../DeployProgressOverlay/PhasedDeployProgressScene";
import type { ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  Layout,
  PhasedDeployProgressScene,
  useAutoDeploymentFlow,
  useServices
};

type Props = {
  /** Display name shown in the progress panel ("Deploying {templateName}"). */
  templateName: string;
  /** The resolved SDL to deploy, already derived from the intent's template on the configure screen. */
  sdl: string;
  /** The resume resolution from the {@link ResumeDeploymentGuard}: any live leases to reconstruct so the manifest re-sends. */
  resume: ResumeResolution;
  /** The shared base flow, created once by the `DeploymentFlowProvider` (seeded from the resolved intent, including a resumed dseq). */
  flow: DeploymentFlow;
  /** Whether the trial wallet can broadcast — gates the autopilot's create. */
  isWalletReady: boolean;
  /** A terminal start-trial failure, projected to the flow's error state so a held create fails instead of waiting forever. */
  trialError: unknown;
  /** Clears a terminal start-trial failure so "Try again" can re-attempt it. */
  retryTrial: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The auto-deploy experience of the bid-screening view: when the configure intent is `sdl-strategy=default` +
 * `bid-strategy=auto`, the screen skips the manual form and drives the deployment automatically through the
 * globe + phased progress panel (create deployment → matching providers → preparing), then redirects to the
 * deployment details. The base flow and trial readiness come from the `DeploymentFlowProvider` (shared with the
 * manual branch), so this component only autopilots over the flow, waiting on the trial wallet spinning up before
 * broadcasting.
 *
 * The created deployment's dseq is written into the URL by the underlying `useDeploymentFlow` state machine (the
 * phased flow autopilots over it), so a reload resumes the same deployment — picking up at matching, or at
 * preparing if a lease already exists — instead of creating a new one. Deploy-success navigation is likewise owned
 * by that flow's built-in redirect.
 */
export const AutoDeployFlow: FC<Props> = ({ templateName, sdl, resume, flow, isWalletReady, trialError, retryTrial, dependencies: d = DEPENDENCIES }) => {
  const { publicConfig } = d.useServices();
  const { state, progressPercent, phases, matchedProviderAddress, tryAgain, stopAutopilot } = d.useAutoDeploymentFlow({
    sdl,
    isWalletReady,
    trialError,
    resumeLeases: resume.activeLeases,
    flow
  });

  /**
   * A terminal start-trial error is sticky and would keep the autopilot pinned to the error state. Reset the
   * trial first (re-attempting it), then restart the flow; the create waits for the fresh trial to provision.
   */
  const resetTrialAndRetryDeploy = useCallback(() => {
    if (trialError) retryTrial();
    tryAgain();
  }, [trialError, retryTrial, tryAgain]);

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <d.PhasedDeployProgressScene
        templateName={templateName}
        state={state}
        progressPercent={progressPercent}
        phases={phases}
        focusedProviderAddress={matchedProviderAddress}
        onTryAgain={resetTrialAndRetryDeploy}
        onContactSupport={() => {
          window.open(publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL, "_blank", "noopener,noreferrer");
        }}
        onChooseProvider={() => {
          // Halt the autopilot before flipping to manual: the bid-strategy change only unmounts this flow once the URL
          // propagates, so stopping here keeps the autopilot from leasing the shared deployment during that window.
          stopAutopilot();
          flow.actions.setBidStrategy("select");
        }}
      />
    </d.Layout>
  );
};
