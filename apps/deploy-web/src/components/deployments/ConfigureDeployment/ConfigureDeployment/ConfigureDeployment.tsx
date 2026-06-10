"use client";
import type { FC } from "react";
import { useEffect } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useAtomValue } from "jotai";
import { useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { usePublicTemplate } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import { hardcodedTemplates } from "@src/utils/templates";
import { ConfigureDeploymentForm } from "../ConfigureDeploymentForm/ConfigureDeploymentForm";

export const DEPENDENCIES = { Layout, NextSeo, ConfigureDeploymentForm, usePublicTemplate, useSearchParams, useSnackbar, Snackbar };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Resolves the SDL the Configure screen starts from, then hands it to the form.
 * A `templateId` query param takes precedence and is resolved the same way the
 * legacy flow does: hardcoded templates (e.g. hello-world) carry their SDL inline
 * and are matched by code, while everything else is fetched as a public gallery
 * template. Without a param the carried-in `deploySdl` atom is used. Keeping
 * resolution here lets the form initialize synchronously from a single source.
 */
export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const searchParams = d.useSearchParams();
  const templateId = searchParams?.get("templateId") ?? undefined;
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const hardcodedTemplate = templateId ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const fetchedTemplateId = hardcodedTemplate ? undefined : templateId;
  const templateQuery = d.usePublicTemplate(fetchedTemplateId);
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(
    function notifyOnTemplateError() {
      if (!fetchedTemplateId || !templateQuery.isError) {
        return;
      }
      enqueueSnackbar(
        <d.Snackbar title="Couldn't load the template" subTitle="Starting from a default deployment instead." iconVariant="error" />,
        { variant: "error" }
      );
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

  const initialSdl = hardcodedTemplate?.content ?? (fetchedTemplateId ? templateQuery.data?.deploy : deploySdl?.content);

  return <d.ConfigureDeploymentForm initialSdl={initialSdl} />;
};
