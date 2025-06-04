"use client";

import type { FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { AccountEmailContactPointCreator } from "@src/components/alerts/AccountEmailContactPointCreator/AccountEmailContactPointCreator";
import { ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentBalanceAlert } from "@src/components/deployments/DeploymentAlerts/DeploymentBalanceAlert";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentAlerts/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";

type Props = {
  dseq: string;
  owner: string;
};

export const DeploymentAlerts: FC<Props> = ({ dseq }) => {
  return (
    <ContactPointsListContainer>
      {contactPointList =>
        contactPointList.isFetched && contactPointList.data.length ? (
          <DeploymentAlertsContainer dseq={dseq}>
            {alerts => (
              <LoadingBlocker isLoading={!contactPointList.isFetched || !alerts.isFetched}>
                <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
                  <DeploymentCloseAlert
                    initialValues={alerts.data?.alerts?.deploymentClosed}
                    onSubmit={values => {
                      alerts.upsert({
                        alerts: {
                          deploymentClosed: values
                        }
                      });
                    }}
                  />
                  <DeploymentBalanceAlert
                    initialValues={alerts.data?.alerts?.deploymentBalance}
                    onSubmit={values => {
                      alerts.upsert({
                        alerts: {
                          deploymentBalance: values
                        }
                      });
                    }}
                  />
                </div>
              </LoadingBlocker>
            )}
          </DeploymentAlertsContainer>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4">To start using alerting you need to add at least one contact point</div>
            <div className="flex gap-4">
              <Link href="/alerts/contact-points/new" className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
                <span>Add contact point</span>
              </Link>
              <AccountEmailContactPointCreator />
            </div>
          </div>
        )
      }
    </ContactPointsListContainer>
  );
};
