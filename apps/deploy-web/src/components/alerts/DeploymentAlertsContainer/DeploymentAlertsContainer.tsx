"use client";

import type { FC, ReactNode } from "react";
import { useMemo } from "react";
import React, { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { merge } from "lodash";

import { usePricing } from "@src/context/PricingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal, denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";

type DeploymentAlertsInput = components["schemas"]["DeploymentAlertCreateInput"]["data"];
type DeploymentAlertsOutput = components["schemas"]["DeploymentAlertsResponse"]["data"];

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

const DEPENDENCIES = {
  usePricing
};

export type Props = {
  deployment: Pick<DeploymentDto, "dseq" | "denom" | "escrowBalance">;
  children: (props: ChildrenProps) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentAlertsContainer: FC<Props> = ({ children, deployment, dependencies: d = DEPENDENCIES }) => {
  const { notificationsApi } = useServices();
  const queryClient = useQueryClient();
  const notificator = useNotificator();
  const { usdToAkt, getPriceForDenom } = d.usePricing();

  const { data, isLoading, isFetched, isError } = notificationsApi.v1.getDeploymentAlerts.useQuery({
    path: {
      dseq: deployment.dseq
    }
  });

  const mutation = notificationsApi.v1.upsertDeploymentAlert.useMutation();

  const convert = useCallback(
    (value: number) => {
      if (deployment.denom !== "uakt") {
        return denomToUdenom(value);
      }
      const akt = usdToAkt(value);

      if (akt === null) {
        throw new Error("Could not convert balance to AKT");
      }

      const converted = denomToUdenom(akt);

      if (converted === null) {
        throw new Error("Could not convert balance to AKT");
      }

      return converted;
    },
    [deployment.denom, usdToAkt]
  );

  const prepareInput = useCallback(
    (input: ContainerInput) => {
      if ("deploymentBalance" in input.alerts && input.alerts.deploymentBalance.threshold) {
        return merge({}, input, {
          alerts: {
            deploymentBalance: {
              threshold: convert(input.alerts.deploymentBalance.threshold)
            }
          }
        });
      }

      return input;
    },
    [convert]
  );

  const toOutput = useCallback(
    (data?: components["schemas"]["DeploymentAlertsResponse"]) => {
      const deploymentBalance = data?.data?.alerts?.deploymentBalance;
      if (deploymentBalance?.threshold) {
        const value = udenomToDenom(deploymentBalance.threshold);
        const price = getPriceForDenom(deployment.denom);

        return merge({}, data?.data, {
          alerts: {
            deploymentBalance: {
              threshold: ceilDecimal(value * price)
            }
          }
        });
      }

      return data?.data;
    },
    [deployment.denom, getPriceForDenom]
  );

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
    const denom = udenomToDenom(deployment.escrowBalance);
    if (deployment.denom !== "uakt") {
      return denom;
    }
    const price = getPriceForDenom(deployment.denom);

    return ceilDecimal(denom * price);
  }, [deployment.denom, deployment.escrowBalance, getPriceForDenom]);

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
