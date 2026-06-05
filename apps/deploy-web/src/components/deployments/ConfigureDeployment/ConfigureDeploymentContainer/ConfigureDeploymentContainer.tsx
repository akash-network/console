"use client";
import type { FC } from "react";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import sdlStore from "@src/store/sdlStore";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";

export const DEPENDENCIES = { Layout, NextSeo, ConfigureDeploymentHeader, ConfigureDeploymentPanes };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentContainer: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  /**
   * Lifted SDL state, mirroring the legacy NewDeploymentContainer#editedManifest pattern:
   * seeded once from the carried-in template; the future ConfigurationPane form becomes
   * the producer that writes generateSdl() output into it.
   */
  const [sdl] = useState(() => deploySdl?.content ?? "");

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <d.NextSeo title="Configure your deployment" />
      <div className="px-6 pt-6">
        <d.ConfigureDeploymentHeader />
      </div>
      <div className="mt-6 flex min-h-0 flex-1">
        <d.ConfigureDeploymentPanes sdl={sdl} />
      </div>
    </d.Layout>
  );
};
