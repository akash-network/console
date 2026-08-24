"use client";

import type { FC, ReactNode } from "react";
import React, { useCallback } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";
import type { DeploymentDto } from "@src/types/deployment";

type DeploymentAlertsInput = components["schemas"]["DeploymentAlertCreateInput"]["data"];
export type DeploymentAlertsOutput = components["schemas"]["DeploymentAlertsResponse"]["data"];

export type FullAlertsInput = {
  deploymentClosed: NonNullable<DeploymentAlertsInput["alerts"]["deploymentClosed"]>;
};

export type ContainerInput = Omit<DeploymentAlertsInput, "owner" | "alerts"> & {
  alerts: {
    deploymentClosed: FullAlertsInput["deploymentClosed"];
  };
};

export type ChildrenProps = {
  data?: DeploymentAlertsOutput;
  upsert: (input: ContainerInput) => Promise<DeploymentAlertsOutput | undefined>;
  isLoading: boolean;
  isSaving: boolean;
  isFetched: boolean;
  isError: boolean;
};

export type Props = {
  deployment: Pick<DeploymentDto, "dseq">;
  children: (props: ChildrenProps) => ReactNode;
};

export const DeploymentAlertsContainer: FC<Props> = ({ children, deployment }) => {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const notificator = useNotificator();

  const { data, isLoading, isFetched, isError } = api.v1.listDeploymentAlerts.useQuery({ dseq: deployment.dseq });

  const mutation = api.v1.upsertDeploymentAlert.useMutation();

  const upsert: ChildrenProps["upsert"] = useCallback(
    async input => {
      try {
        const result = await mutation.mutateAsync({
          dseq: deployment.dseq,
          data: input
        });

        return result?.data;
      } catch {
        notificator.error("Alert configuration failed...", { dataTestId: "alert-config-error-notification" });
      }
    },
    [deployment.dseq, mutation, notificator]
  );

  useWhen(
    mutation.isSuccess,
    async () => {
      notificator.success("Alert configured!", { dataTestId: "alert-config-success-notification" });
      await queryClient.invalidateQueries({
        queryKey: api.v1.listDeploymentAlerts.getKey({ dseq: deployment.dseq })
      });
    },
    [deployment.dseq]
  );

  return (
    <>
      {children({
        data: data?.data,
        upsert,
        isLoading,
        isSaving: mutation.isPending,
        isFetched,
        isError
      })}
    </>
  );
};
