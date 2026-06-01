"use client";
import type { FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";

export const ConfigureDeploymentContainer: FC = () => {
  return (
    <Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <NextSeo title="Configure your deployment" />
      <div className="px-6 pt-6">
        <ConfigureDeploymentHeader />
      </div>
      <div className="mt-6 flex min-h-0 flex-1">
        <ConfigureDeploymentPanes />
      </div>
    </Layout>
  );
};
