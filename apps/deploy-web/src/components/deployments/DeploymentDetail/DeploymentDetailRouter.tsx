"use client";
import type { FC } from "react";

import { DeploymentDetailLegacy } from "@src/components/deployments/DeploymentDetailLegacy";
import { useFlag } from "@src/hooks/useFlag";
import { DeploymentDetail } from "./DeploymentDetail";

export const DEPENDENCIES = {
  useFlag,
  DeploymentDetail,
  DeploymentDetailLegacy
};

export interface DeploymentDetailRouterProps {
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDetailRouter: FC<DeploymentDetailRouterProps> = ({ dseq, dependencies: d = DEPENDENCIES }) => {
  const isRedesignEnabled = d.useFlag("deployment_detail_redesign");

  return isRedesignEnabled ? <d.DeploymentDetail dseq={dseq} /> : <d.DeploymentDetailLegacy dseq={dseq} />;
};
