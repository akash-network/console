"use client";
import type { FC } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";

import { PhasedDeploymentContainer } from "@src/components/deployments/PhasedDeploymentContainer/PhasedDeploymentContainer";
import Layout from "@src/components/layout/Layout";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  PhasedDeploymentContainer,
  useEnsureTrialStarted,
  useRouter,
  useSnackbar,
  Snackbar
};

type Props = {
  /** Display name shown in the progress panel ("Deploying {templateName}"). */
  templateName: string;
  /** The resolved SDL to deploy, already derived from the intent's template on the configure screen. */
  sdl: string;
  /** The template the flow deploys; used to fall back to manual configuration if the user starts over. */
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
 * The created deployment's dseq is written into the URL (`/new-deployment/configure/:dseq?...`) so a reload
 * resumes the same deployment — picking up at matching, or at preparing if a lease already exists — instead of
 * creating a new one.
 */
export const AutoDeployFlow: FC<Props> = ({ templateName, sdl, templateId, dseq, draftId, dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();
  const { isWalletReady, error: trialError } = d.useEnsureTrialStarted();

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col dark:bg-card">
      <d.PhasedDeploymentContainer
        templateName={templateName}
        sdl={sdl}
        isWalletReady={isWalletReady}
        trialError={trialError}
        initialDseq={dseq}
        onDeploymentCreated={createdDseq => {
          // Shallow-replace to add the dseq route segment while preserving the intent params, so a reload resumes
          // this deployment rather than starting over. Same route file (optional catch-all), so shallow holds.
          router.replace(
            UrlService.configureDeployment({ dseq: createdDseq, templateId, sdlStrategy: templateId ? "default" : undefined, bidStrategy: "auto", draftId }),
            undefined,
            { shallow: true }
          );
        }}
        onSuccess={dseq => {
          enqueueSnackbar(<d.Snackbar title="Deployment prepared!" subTitle="We're redirecting you to the deployment details..." iconVariant="success" />, {
            variant: "success"
          });
          router.replace(UrlService.deploymentDetails(dseq));
        }}
        onCancel={() => router.replace(UrlService.configureDeployment({ templateId, sdlStrategy: templateId ? "default" : undefined }))}
      />
    </d.Layout>
  );
};
