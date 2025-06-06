"use client";

import type { FC, ReactNode } from "react";
import React, { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type DeploymentAlertsInput = components["schemas"]["DeploymentAlertCreateInput"]["data"];
type DeploymentAlertsOutput = components["schemas"]["DeploymentAlertsResponse"]["data"];

export type ContainerInput = Omit<DeploymentAlertsInput, "owner" | "alerts"> & {
  alerts:
    | {
        deploymentClosed: NonNullable<DeploymentAlertsInput["alerts"]["deploymentClosed"]>;
      }
    | {
        deploymentBalance: NonNullable<DeploymentAlertsInput["alerts"]["deploymentBalance"]>;
      }
    | {
        deploymentClosed: NonNullable<DeploymentAlertsInput["alerts"]["deploymentClosed"]>;
        deploymentBalance: NonNullable<DeploymentAlertsInput["alerts"]["deploymentBalance"]>;
      };
};

export type ChildrenProps = {
  data?: DeploymentAlertsOutput;
  upsert: (input: ContainerInput) => void;
  isLoading: boolean;
  isFetched: boolean;
  isError: boolean;
};

type Props = {
  dseq: string;
  children: (props: ChildrenProps) => ReactNode;
};

export const DeploymentAlertsContainer: FC<Props> = ({ dseq, children }) => {
  const { notificationsApi } = useServices();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const notificator = useNotificator();

  const { data, isLoading, isFetched, isError } = notificationsApi.v1.getDeploymentAlerts.useQuery({
    path: {
      dseq
    }
  });

  const mutation = notificationsApi.v1.upsertDeploymentAlert.useMutation();

  const upsert: ChildrenProps["upsert"] = useCallback(
    input => {
      mutation.mutate({
        path: {
          dseq
        },
        body: {
          data: {
            owner: address,
            ...input
          }
        }
      });
    },
    [address, dseq, mutation]
  );

  useWhen(
    mutation.isSuccess,
    async () => {
      notificator.success("Alert configured!", { dataTestId: "alert-config-success-notification" });
      await queryClient.invalidateQueries({
        queryKey: notificationsApi.v1.getDeploymentAlerts.getQueryKey({
          path: {
            dseq
          }
        })
      });
    },
    [dseq]
  );

  useWhen(mutation.isError, () => {
    notificator.error("Alert configuration failed...", { dataTestId: "alert-config-error-notification" });
  });

  return (
    <>
      {children({
        data: data?.data,
        upsert,
        isLoading,
        isFetched,
        isError
      })}
    </>
  );
};
