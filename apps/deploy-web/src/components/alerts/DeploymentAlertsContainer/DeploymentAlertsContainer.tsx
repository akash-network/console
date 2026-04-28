"use client";

import type { FC, ReactNode } from "react";
import React, { useCallback, useMemo } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { merge } from "lodash";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";
import type { DeploymentDto } from "@src/types/deployment";
import { denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";

type DeploymentAlertsInput = components["schemas"]["DeploymentAlertCreateInput"]["data"];
export type DeploymentAlertsOutput = components["schemas"]["DeploymentAlertsResponse"]["data"];

export type FullAlertsInput = {
  deploymentClosed: NonNullable<DeploymentAlertsInput["alerts"]["deploymentClosed"]>;
  deploymentBalance: NonNullable<DeploymentAlertsInput["alerts"]["deploymentBalance"]>;
};

export type ContainerInput = Omit<DeploymentAlertsInput, "owner" | "alerts"> & {
  alerts:
    | {
        deploymentClosed: FullAlertsInput["deploymentClosed"];
      }
    | {
        deploymentBalance: FullAlertsInput["deploymentBalance"];
      }
    | FullAlertsInput;
};

export type ChildrenProps = {
  data?: DeploymentAlertsOutput;
  upsert: (input: ContainerInput) => Promise<DeploymentAlertsOutput | undefined>;
  isLoading: boolean;
  isFetched: boolean;
  isError: boolean;
  maxBalanceThreshold: number;
};

export type Props = {
  deployment: Pick<DeploymentDto, "dseq" | "escrowBalance">;
  children: (props: ChildrenProps) => ReactNode;
};

export const DeploymentAlertsContainer: FC<Props> = ({ children, deployment }) => {
  const { notificationsApi } = useServices();
  const queryClient = useQueryClient();
  const notificator = useNotificator();

  const { data, isLoading, isFetched, isError } = notificationsApi.v1.getDeploymentAlerts.useQuery({
    path: {
      dseq: deployment.dseq
    }
  });

  const mutation = notificationsApi.v1.upsertDeploymentAlert.useMutation();

  const prepareInput = useCallback((input: ContainerInput) => {
    if ("deploymentBalance" in input.alerts && input.alerts.deploymentBalance.threshold) {
      return merge({}, input, {
        alerts: {
          deploymentBalance: {
            threshold: denomToUdenom(input.alerts.deploymentBalance.threshold)
          }
        }
      });
    }

    return input;
  }, []);

  const toOutput = useCallback((data?: components["schemas"]["DeploymentAlertsResponse"]) => {
    const deploymentBalance = data?.data?.alerts?.deploymentBalance;
    if (deploymentBalance?.threshold) {
      return merge({}, data?.data, {
        alerts: {
          deploymentBalance: {
            threshold: udenomToDenom(deploymentBalance.threshold)
          }
        }
      });
    }

    return data?.data;
  }, []);

  const output = useMemo(() => toOutput(data), [data, toOutput]);

  const upsert: ChildrenProps["upsert"] = useCallback(
    async input => {
      try {
        const result = await mutation.mutateAsync({
          path: {
            dseq: deployment.dseq
          },
          body: {
            data: prepareInput(input)
          }
        });

        return toOutput(result);
      } catch (e) {
        notificator.error("Alert configuration failed...", { dataTestId: "alert-config-error-notification" });
      }
    },
    [deployment.dseq, mutation, notificator, prepareInput, toOutput]
  );

  useWhen(
    mutation.isSuccess,
    async () => {
      notificator.success("Alert configured!", { dataTestId: "alert-config-success-notification" });
      await queryClient.invalidateQueries({
        queryKey: notificationsApi.v1.getDeploymentAlerts.getQueryKey({
          path: {
            dseq: deployment.dseq
          }
        })
      });
    },
    [deployment.dseq]
  );

  const maxBalanceThreshold = useMemo(() => {
    return udenomToDenom(deployment.escrowBalance);
  }, [deployment.escrowBalance]);

  return (
    <>
      {children({
        data: output,
        upsert,
        isLoading,
        isFetched,
        isError,
        maxBalanceThreshold
      })}
    </>
  );
};
