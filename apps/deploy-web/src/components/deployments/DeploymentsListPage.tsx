"use client";
import type { FC } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { DeploymentsList } from "./DeploymentsList/DeploymentsList";
import { useApiDeploymentsListSource } from "./DeploymentsList/useApiDeploymentsListSource";
import { useChainDeploymentsListSource } from "./DeploymentsList/useDeploymentsListSource";
import { DeploymentList } from "./DeploymentList";

export const DEPENDENCIES = { useFlag, DeploymentList, DeploymentsList, useApiDeploymentsListSource, useChainDeploymentsListSource };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsListPage: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const isRedesigned = d.useFlag("ui_deployments_list_redesign");
  const isServedByApi = d.useFlag("ui_deployments_list_api");

  if (!isRedesigned) return <d.DeploymentList />;

  /** Keyed on the choice so flipping the flag remounts: the two sources call different hooks. */
  return (
    <d.DeploymentsList
      key={isServedByApi ? "api" : "chain"}
      useDeploymentsListSource={isServedByApi ? d.useApiDeploymentsListSource : d.useChainDeploymentsListSource}
    />
  );
};
