"use client";

import type { FC } from "react";

import { ContactPointsGuard } from "@src/components/alerts/ContactPointsGuard/ContactPointsGuard";
import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentBalanceAlert } from "@src/components/deployments/DeploymentAlerts/DeploymentBalanceAlert";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentAlerts/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { DeploymentDto } from "@src/types/deployment";

type Props = {
  deployment: DeploymentDto;
};

export const DeploymentAlertsView: FC<ChildrenProps & Props> = props => {
  return (
    <LoadingBlocker isLoading={!props.isFetched}>
      <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
        <DeploymentCloseAlert
          initialValues={props.data?.alerts?.deploymentClosed}
          onSubmit={values => {
            props.upsert({
              alerts: {
                deploymentClosed: values
              }
            });
          }}
        />
        <DeploymentBalanceAlert
          deployment={props.deployment}
          initialValues={props.data?.alerts?.deploymentBalance}
          onSubmit={values => {
            props.upsert({
              alerts: {
                deploymentBalance: values
              }
            });
          }}
        />
      </div>
    </LoadingBlocker>
  );
};

export const DeploymentAlerts: FC<Props> = ({ deployment }) => {
  return (
    <ContactPointsGuard>
      <DeploymentAlertsContainer dseq={deployment.dseq}>{props => <DeploymentAlertsView {...props} deployment={deployment} />}</DeploymentAlertsContainer>
    </ContactPointsGuard>
  );
};
