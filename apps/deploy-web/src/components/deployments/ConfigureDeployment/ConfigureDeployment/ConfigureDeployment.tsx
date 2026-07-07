"use client";
import type { FC } from "react";
import { useEffect, useMemo } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useAtomValue } from "jotai";
import { useParams, useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { usePublicTemplate } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { hardcodedTemplates } from "@src/utils/templates";
import { AutoDeployFlow } from "../AutoDeployFlow/AutoDeployFlow";
import { ConfigureDeploymentForm } from "../ConfigureDeploymentForm/ConfigureDeploymentForm";
import { RedirectIfLeased } from "../RedirectIfLeased/RedirectIfLeased";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { parseDeploymentIntent } from "../useDeploymentFlow/deploymentIntent";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  AutoDeployFlow,
  ConfigureDeploymentForm,
  RedirectIfLeased,
  usePublicTemplate,
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
 * carry their SDL inline and are matched by code, while everything else is fetched as a public gallery template; with
 * neither, the carried-in `deploySdl` atom is used. Keeping resolution here lets the form initialize synchronously from
 * a single source — and lets a resume skip the template fetch.
 */
export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const searchParams = d.useSearchParams();
  const routeParams = d.useParams();
  const dseqSegment = Array.isArray(routeParams?.dseq) ? routeParams.dseq[0] : (routeParams?.dseq as string | undefined);
  const intent = parseDeploymentIntent({ dseqSegment, searchParams: new URLSearchParams(searchParams?.toString() ?? "") });
  const draft = d.useConfigureDraft(intent);
  const resolvedIntent = useMemo<DeploymentIntent>(
    () => ({ templateId: intent.templateId, sdlStrategy: intent.sdlStrategy, bidStrategy: intent.bidStrategy, dseq: intent.dseq, draftId: draft.draftId }),
    [intent.templateId, intent.sdlStrategy, intent.bidStrategy, intent.dseq, draft.draftId]
  );

  const templateId = searchParams?.get("templateId") ?? undefined;
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const hardcodedTemplate: TemplateCreation | undefined = templateId ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const fetchedTemplateId = draft.persistedSdl === undefined && !hardcodedTemplate ? templateId : undefined;
  const templateQuery = d.usePublicTemplate(fetchedTemplateId);
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(
    function notifyOnTemplateError() {
      if (!fetchedTemplateId || !templateQuery.isError) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the template" subTitle="Starting from a default deployment instead." iconVariant="error" />, {
        variant: "error"
      });
    },
    [fetchedTemplateId, templateQuery.isError, enqueueSnackbar, d]
  );

  const initialSdl = draft.persistedSdl ?? hardcodedTemplate?.content ?? (fetchedTemplateId ? templateQuery.data?.deploy : deploySdl?.content);
  const initialName = draft.persistedName ?? hardcodedTemplate?.name ?? (fetchedTemplateId ? templateQuery.data?.name : undefined);

  const isAutoDeploy = resolvedIntent.sdlStrategy === "default" && resolvedIntent.bidStrategy === "auto";
  if (isAutoDeploy && initialSdl) {
    const templateName = templateQuery.data?.name ?? hardcodedTemplate?.title ?? "your deployment";
    return (
      <d.AutoDeployFlow
        templateId={resolvedIntent.templateId}
        templateName={templateName}
        sdl={initialSdl}
        dseq={resolvedIntent.dseq}
        draftId={resolvedIntent.draftId}
      />
    );
  }

  return (
    <d.RedirectIfLeased dseq={intent.dseq}>
      {fetchedTemplateId && templateQuery.isLoading ? (
        <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
          <d.NextSeo title="Configure your deployment" />
          <div className="flex flex-1 items-center justify-center">
            <Spinner size="large" />
          </div>
        </d.Layout>
      ) : (
        <d.ConfigureDeploymentForm key={draft.draftId} initialSdl={initialSdl} initialName={initialName} intent={resolvedIntent} />
      )}
    </d.RedirectIfLeased>
  );
};
