"use client";
import type { FC } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { DeploymentsList } from "./DeploymentsList/DeploymentsList";
import { DeploymentList } from "./DeploymentList";

export const DEPENDENCIES = { useFlag, DeploymentList, DeploymentsList };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsListPage: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  return d.useFlag("ui_deployments_list_redesign") ? <d.DeploymentsList /> : <d.DeploymentList />;
};
