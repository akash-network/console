import { useCallback } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useSendCloseBatch } from "@src/hooks/useCloseBatches/useCloseBatches";

export const DEPENDENCIES = { useServices, useSendCloseBatch, useSnackbar, useQueryClient };

/** A deployment in neither list was not closed: its close was refused. */
export type BulkCloseOutcome = { closed: string[]; closing: string[] };

/** Closes several deployments, each in the background under one bulk close. */
export function useCloseDeployments(dependencies: typeof DEPENDENCIES = DEPENDENCIES): (dseqs: string[]) => Promise<BulkCloseOutcome> {
  const { api } = dependencies.useServices();
  const sendCloseBatch = dependencies.useSendCloseBatch();
  const { mutateAsync: requestClose } = api.v1.closeDeployment.useMutation();
  const queryClient = dependencies.useQueryClient();
  const { enqueueSnackbar } = dependencies.useSnackbar();

  const reportRefusals = useCallback(
    (refusals: unknown[]) => {
      const count = refusals.length === 1 ? "1 deployment" : `${refusals.length} deployments`;
      enqueueSnackbar(
        <Snackbar title={`Couldn't close ${count}`} subTitle={extractApiErrorMessage(refusals[0]) ?? "Try again in a moment."} iconVariant="error" />,
        { variant: "error" }
      );
    },
    [enqueueSnackbar]
  );

  return useCallback(
    async (dseqs: string[]): Promise<BulkCloseOutcome> => {
      const answers = await sendCloseBatch(batchId => Promise.allSettled(dseqs.map(dseq => requestClose({ dseq, async: "true", batchId }))));
      await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });

      const outcome: BulkCloseOutcome = { closed: [], closing: [] };
      const refusals: unknown[] = [];
      answers.forEach((answer, index) => {
        if (answer.status === "rejected") refusals.push(answer.reason);
        else if ("activityId" in answer.value.data) outcome.closing.push(dseqs[index]);
        else outcome.closed.push(dseqs[index]);
      });

      if (refusals.length > 0) reportRefusals(refusals);
      return outcome;
    },
    [sendCloseBatch, requestClose, queryClient, api, reportRefusals]
  );
}
