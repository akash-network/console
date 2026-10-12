import { useCallback } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useMarkActivityOutcomes } from "@src/hooks/useHandledActivityOutcomes/useHandledActivityOutcomes";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useServices, useSnackbar, useQueryClient, useMarkActivityOutcomes };

/** Requests the deployment's live leases again, which the api answers by sending their providers the deployment they never received. */
export function useSendDeploymentAgain(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = dependencies.useServices();
  const { mutateAsync: requestLeases, isPending: isSending } = api.v1.createLease.useMutation();
  const queryClient = dependencies.useQueryClient();
  const { enqueueSnackbar } = dependencies.useSnackbar();
  const { forgetEarlierOutcomes, markOutcomeHandled } = dependencies.useMarkActivityOutcomes();

  const sendAgain = useCallback(
    async ({ dseq, leases }: { dseq: string; leases: LeaseDto[] }) => {
      forgetEarlierOutcomes("lease_create", dseq);
      try {
        await requestLeases({ async: "true", leases: leases.filter(isLeaseLive).map(({ gseq, oseq, provider }) => ({ dseq, gseq, oseq, provider })) });
        await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
      } catch (error) {
        markOutcomeHandled("lease_create", dseq, "failed");
        enqueueSnackbar(
          <Snackbar title="Couldn't send the deployment" subTitle={extractApiErrorMessage(error) ?? "Try again in a moment."} iconVariant="error" />,
          { variant: "error" }
        );
      }
    },
    [requestLeases, queryClient, api, enqueueSnackbar, forgetEarlierOutcomes, markOutcomeHandled]
  );

  return { sendAgain, isSending };
}
