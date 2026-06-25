"use client";
import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { usePublicTemplate } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import { hardcodedTemplates } from "@src/utils/templates";
import { ConfigureDeploymentForm } from "../ConfigureDeploymentForm/ConfigureDeploymentForm";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { parseDeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  ConfigureDeploymentForm,
  usePublicTemplate,
  useConfigureDraft,
  useSearchParams,
  useParams,
  useRouter,
  useSnackbar,
  Snackbar,
  mintDraftId
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Resolves the SDL the Configure screen starts from, then hands it to the form. A `draftId` query param identifies
 * a started session: when present, the persisted working draft is restored and the template is ignored; when absent,
 * an id is minted, the screen seeds from the template (or carried-in SDL), and the id is written back into the URL so
 * a reload resumes the same draft. Without a draft, a `templateId` is resolved the same way the legacy flow does:
 * hardcoded templates (e.g. hello-world) carry their SDL inline and are matched by code, while everything else is
 * fetched as a public gallery template; with neither, the carried-in `deploySdl` atom is used. Keeping resolution
 * here lets the form initialize synchronously from a single source — and lets a resume skip the template fetch.
 */
export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const searchParams = d.useSearchParams();
  const routeParams = d.useParams();
  const router = d.useRouter();
  const dseqSegment = Array.isArray(routeParams?.dseq) ? routeParams.dseq[0] : (routeParams?.dseq as string | undefined);
  const intent = parseDeploymentIntent({ dseqSegment, searchParams: new URLSearchParams(searchParams?.toString() ?? "") });
  const [draftId] = useState(() => intent.draftId ?? d.mintDraftId());
  const draft = d.useConfigureDraft(draftId);
  const [persistedSdl] = useState(() => draft.read());
  const resolvedIntent = useMemo<DeploymentIntent>(
    () => ({ templateId: intent.templateId, sdlStrategy: intent.sdlStrategy, bidStrategy: intent.bidStrategy, dseq: intent.dseq, draftId }),
    [intent.templateId, intent.sdlStrategy, intent.bidStrategy, intent.dseq, draftId]
  );

  const templateId = searchParams?.get("templateId") ?? undefined;
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const hardcodedTemplate = templateId ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const fetchedTemplateId = persistedSdl === undefined && !hardcodedTemplate ? templateId : undefined;
  const templateQuery = d.usePublicTemplate(fetchedTemplateId);
  const { enqueueSnackbar } = d.useSnackbar();

  const replacedDraftIdRef = useRef(false);
  useEffect(
    function persistDraftIdInUrl() {
      if (intent.draftId === draftId || replacedDraftIdRef.current) {
        return;
      }
      replacedDraftIdRef.current = true;
      router.replace(buildConfigureUrl(resolvedIntent, resolvedIntent.dseq, resolvedIntent.bidStrategy), undefined, { shallow: true });
    },
    [intent.draftId, draftId, resolvedIntent, router]
  );

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

  if (fetchedTemplateId && templateQuery.isLoading) {
    return (
      <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
        <d.NextSeo title="Configure your deployment" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="large" />
        </div>
      </d.Layout>
    );
  }

  const initialSdl = persistedSdl ?? hardcodedTemplate?.content ?? (fetchedTemplateId ? templateQuery.data?.deploy : deploySdl?.content);

  return <d.ConfigureDeploymentForm initialSdl={initialSdl} intent={resolvedIntent} />;
};

/** Mints the id that keys a configure session's persisted draft. */
function mintDraftId(): string {
  return nanoid();
}
