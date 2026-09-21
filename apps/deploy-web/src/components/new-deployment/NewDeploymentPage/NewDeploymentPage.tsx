"use client";
import type { FC } from "react";

import Layout from "@src/components/layout/Layout";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { LegacyBuilderRedirect } from "../LegacyBuilderRedirect/LegacyBuilderRedirect";
import { TemplateList } from "../TemplateList";

export const DEPENDENCIES = { Layout, TemplateList, LegacyBuilderRedirect, useTemplates };

type Props = { dependencies?: typeof DEPENDENCIES };

/** The deployment-type and template picker at `/new-deployment`. Every pick routes on to Configure, which is the one place a deployment is created. */
export const NewDeploymentPage: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { isLoading } = d.useTemplates();

  return (
    <d.LegacyBuilderRedirect>
      <d.Layout isLoading={isLoading} containerClassName="pb-0 h-full">
        <d.TemplateList />
      </d.Layout>
    </d.LegacyBuilderRedirect>
  );
};
