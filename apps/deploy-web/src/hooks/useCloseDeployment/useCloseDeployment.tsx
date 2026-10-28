import { useCallback } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = { useServices, useSnackbar, useQueryClient };

/** `closing` means the close was accepted to run in the background, and the activity host reports how it ends. */
export type CloseOutcome = "closed" | "closing" | "not_closed";

export function useCloseDeployment(dependencies: typeof DEPENDENCIES = DEPENDENCIES): (dseq: string) => Promise<CloseOutcome> {
  const { api } = dependencies.useServices();
  const { mutateAsync: requestClose } = api.v1.closeDeployment.useMutation();
  const queryClient = dependencies.useQueryClient();
  const { enqueueSnackbar } = dependencies.useSnackbar();

  return useCallback(
    async (dseq: string) => {
      try {
        const { data } = await requestClose({ dseq, async: "true" });
        await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
        return "activityId" in data ? "closing" : "closed";
      } catch (error) {
        enqueueSnackbar(
          <Snackbar title="Couldn't close this deployment" subTitle={extractApiErrorMessage(error) ?? "Try again in a moment."} iconVariant="error" />,
          { variant: "error" }
        );
        return "not_closed";
      }
    },
    [requestClose, queryClient, api, enqueueSnackbar]
  );
}
