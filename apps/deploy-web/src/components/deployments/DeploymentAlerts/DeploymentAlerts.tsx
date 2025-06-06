"use client";

import type { FC } from "react";

import { ContactPointsGuard } from "@src/components/alerts/ContactPointsGuard/ContactPointsGuard";
import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentBalanceAlert } from "@src/components/deployments/DeploymentBalanceAlert/DeploymentBalanceAlert";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { DeploymentDto } from "@src/types/deployment";

const COMPONENTS = {
  DeploymentCloseAlert,
  DeploymentBalanceAlert
};

export type Props = {
  deployment: DeploymentDto;
  components?: typeof COMPONENTS;
};

export const DeploymentAlertsView: FC<ChildrenProps & Props> = ({ deployment, isFetched, data, upsert, components: c = COMPONENTS }) => {
  return (
    <LoadingBlocker isLoading={!isFetched}>
      <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
        <c.DeploymentCloseAlert
          initialValues={data?.alerts?.deploymentClosed}
          onSubmit={values => {
            upsert({
              alerts: {
                deploymentClosed: values
              }
            });
          }}
        />
        <c.DeploymentBalanceAlert
          deployment={deployment}
          initialValues={data?.alerts?.deploymentBalance}
          onSubmit={values => {
            upsert({
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
