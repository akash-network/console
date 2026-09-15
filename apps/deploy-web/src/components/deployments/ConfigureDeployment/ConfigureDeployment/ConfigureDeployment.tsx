"use client";
import type { FC } from "react";
import { useEffect, useMemo } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useAtomValue } from "jotai";
import { useParams, useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { usePublicTemplate, useTemplate } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { hardcodedTemplates } from "@src/utils/templates";
import { AutoDeployFlow } from "../AutoDeployFlow/AutoDeployFlow";
import { ConfigureDeploymentForm } from "../ConfigureDeploymentForm/ConfigureDeploymentForm";
import { DeploymentFlowProvider } from "../DeploymentFlowProvider/DeploymentFlowProvider";
import { ResumeDeploymentGuard } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { parseDeploymentIntent } from "../useDeploymentFlow/deploymentIntent";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  AutoDeployFlow,
  ConfigureDeploymentForm,
  DeploymentFlowProvider,
  ResumeDeploymentGuard,
  usePublicTemplate,
  useUserTemplate: useTemplate,
  useConfigureDraft,
  useSearchParams,
  useParams,
  useSnackbar,
  Snackbar
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Resolves the SDL the Configure screen starts from, then hands it to the form. The draft session (see
 * `useConfigureDraft`) identifies a started session by a `draftId`: when present its persisted working SDL is restored
 * and the template is ignored; when absent an id is minted and written into the URL so a reload resumes the same draft.
 * Without a draft, a `templateId` is resolved the same way the legacy flow does: hardcoded templates (e.g. hello-world)
 * carry their SDL inline and are matched by code, while everything else is fetched as a public gallery template. A
 * `userTemplateId` instead fetches the viewer's own saved template, which the API answers with an empty body when it
 * isn't theirs to see — surfaced as the same "couldn't load" fallback as a failed request. With neither, the carried-in
 * `deploySdl` atom is used, except on a `vm=true` entry, which ignores the atom so a fresh Container-VM session always
 * seeds deterministically. Keeping resolution here lets the form initialize synchronously from a single source — and
 * lets a resume skip the template fetch.
 */
export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const searchParams = d.useSearchParams();
  const routeParams = d.useParams();
  const dseqSegment = Array.isArray(routeParams?.dseq) ? routeParams.dseq[0] : (routeParams?.dseq as string | undefined);
  const intent = parseDeploymentIntent({ dseqSegment, searchParams: new URLSearchParams(searchParams?.toString() ?? "") });
  const draft = d.useConfigureDraft(intent);
  const resolvedIntent = useMemo<DeploymentIntent>(
    () => ({
      templateId: intent.templateId,
      userTemplateId: intent.userTemplateId,
      sdlStrategy: intent.sdlStrategy,
      bidStrategy: intent.bidStrategy,
      dseq: intent.dseq,
      draftId: draft.draftId,
      vm: intent.vm
    }),
    [intent.templateId, intent.userTemplateId, intent.sdlStrategy, intent.bidStrategy, intent.dseq, draft.draftId, intent.vm]
  );

  const templateId = intent.templateId;
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const hardcodedTemplate: TemplateCreation | undefined = templateId ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const isDraftRestored = draft.persistedSdl !== undefined;
  const fetchedTemplateId = isDraftRestored || hardcodedTemplate ? undefined : templateId;
  const fetchedUserTemplateId = isDraftRestored ? undefined : intent.userTemplateId;
  const templateQuery = d.usePublicTemplate(fetchedTemplateId);
  const userTemplateQuery = d.useUserTemplate(fetchedUserTemplateId);
  const { enqueueSnackbar } = d.useSnackbar();

  const isFetchingTemplate = !!fetchedTemplateId || !!fetchedUserTemplateId;
  const isTemplateLoading = (!!fetchedTemplateId && templateQuery.isLoading) || (!!fetchedUserTemplateId && userTemplateQuery.isLoading);
  const hasTemplateFailed =
    (!!fetchedTemplateId && templateQuery.isError) ||
    (!!fetchedUserTemplateId && (userTemplateQuery.isError || (userTemplateQuery.isSuccess && !userTemplateQuery.data?.sdl)));

  useEffect(
    function notifyOnTemplateError() {
      if (!hasTemplateFailed) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the template" subTitle="Starting from a default deployment instead." iconVariant="error" />, {
        variant: "error"
      });
    },
    [hasTemplateFailed, enqueueSnackbar, d]
  );

  const fetchedSdl = fetchedTemplateId ? templateQuery.data?.deploy : userTemplateQuery.data?.sdl;
  const fetchedName = fetchedTemplateId ? templateQuery.data?.name : userTemplateQuery.data?.title;
  const carriedInSdl = intent.vm ? undefined : deploySdl?.content;
  const initialSdl = draft.persistedSdl ?? hardcodedTemplate?.content ?? (isFetchingTemplate ? fetchedSdl : carriedInSdl);
  const initialName = draft.persistedName ?? hardcodedTemplate?.name ?? (isFetchingTemplate ? fetchedName : undefined);

  const isAutoDeploy = resolvedIntent.sdlStrategy === "default" && resolvedIntent.bidStrategy === "auto";
  const templateName = templateQuery.data?.name ?? hardcodedTemplate?.title ?? "your deployment";

  // Only the auto flow (with an SDL in hand) can finish an already-leased deployment by re-sending its manifest;
  // a manual visitor or a cold resume with no SDL is sent to the detail page instead. The DeploymentFlowProvider owns
  // the single flow both branches share — keyed by the draft so a draft change remounts a fresh flow, while an
  // auto↔manual switch within one draft keeps it. It sits below the guard so the flow only mounts once the guard has
  // settled the dseq. The template-loading spinner stays above the provider so the trial isn't started mid-fetch.
  return (
    <d.ResumeDeploymentGuard intent={resolvedIntent} canResume={isAutoDeploy && !!initialSdl}>
      {resume => {
        if (isTemplateLoading) {
          return (
            <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
              <d.NextSeo title="Configure your deployment" />
              <div className="flex flex-1 items-center justify-center">
                <Spinner size="large" />
              </div>
            </d.Layout>
          );
        }

        return (
          <d.DeploymentFlowProvider key={draft.draftId} intent={resolvedIntent}>
            {({ flow }) =>
              isAutoDeploy && initialSdl ? (
                <d.AutoDeployFlow templateName={templateName} sdl={initialSdl} resume={resume} flow={flow} />
              ) : (
                <d.ConfigureDeploymentForm initialSdl={initialSdl} initialName={initialName} intent={resolvedIntent} flow={flow} />
              )
            }
          </d.DeploymentFlowProvider>
        );
      }}
    </d.ResumeDeploymentGuard>
  );
};
