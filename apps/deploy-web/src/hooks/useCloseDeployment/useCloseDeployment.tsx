import { useCallback } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = { useServices, useWallet, useFlag, useSnackbar, useQueryClient };

/** `closing` means the close was accepted to run in the background, and the activity host reports how it ends. */
export type CloseOutcome = "closed" | "closing" | "not_closed";

/** Closes one deployment in the background while the activity center is on, and through the wallet's blocking dialog otherwise. */
export function useCloseDeployment(dependencies: typeof DEPENDENCIES = DEPENDENCIES): (dseq: string) => Promise<CloseOutcome> {
  const { api } = dependencies.useServices();
  const { address, signAndBroadcastTx } = dependencies.useWallet();
  const isClosingInBackground = dependencies.useFlag("notifications_activity_center");
  const { mutateAsync: requestClose } = api.v1.closeDeployment.useMutation();
  const queryClient = dependencies.useQueryClient();
  const { enqueueSnackbar } = dependencies.useSnackbar();

  return useCallback(
    async (dseq: string) => {
      if (!isClosingInBackground) {
        const response = await signAndBroadcastTx([TransactionMessageData.getCloseDeploymentMsg(address, dseq)]);
        return response ? "closed" : "not_closed";
      }

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
    [isClosingInBackground, signAndBroadcastTx, address, requestClose, queryClient, api, enqueueSnackbar]
  );
}
