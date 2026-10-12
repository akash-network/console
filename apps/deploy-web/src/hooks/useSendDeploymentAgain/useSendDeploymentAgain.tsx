import { useCallback } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useServices, useSnackbar, useQueryClient };

/** Requests the deployment's live leases again, which the api answers by sending their providers the deployment they never received. */
export function useSendDeploymentAgain(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = dependencies.useServices();
  const { mutateAsync: requestLeases, isPending: isSending } = api.v1.createLease.useMutation();
  const queryClient = dependencies.useQueryClient();
  const { enqueueSnackbar } = dependencies.useSnackbar();

  const sendAgain = useCallback(
    async (leases: LeaseDto[]) => {
      try {
        await requestLeases({ async: "true", leases: leases.filter(isLeaseLive).map(({ dseq, gseq, oseq, provider }) => ({ dseq, gseq, oseq, provider })) });
        await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
      } catch (error) {
        enqueueSnackbar(
          <Snackbar title="Couldn't send the deployment" subTitle={extractApiErrorMessage(error) ?? "Try again in a moment."} iconVariant="error" />,
          { variant: "error" }
        );
      }
    },
    [requestLeases, queryClient, api, enqueueSnackbar]
  );

  return { sendAgain, isSending };
}
