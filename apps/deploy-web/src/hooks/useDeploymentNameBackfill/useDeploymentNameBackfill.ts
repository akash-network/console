"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useServices, useQueryClient };

export interface ApiDeploymentName {
  dseq: string;
  /** Null is the api answering that it holds no name, so a deployment it has not answered for belongs in no list handed to the backfill. */
  name: string | null;
}

/** The deployments to record, sorted and deduplicated into one value, so a surface re-rendering with the same answers asks for nothing again. */
function toUnnamedKey(apiNames: ReadonlyArray<ApiDeploymentName>): string {
  return [...new Set(apiNames.filter(({ name }) => name === null).map(({ dseq }) => dseq))].sort().join(",");
}

/**
 * Records a name only this browser holds in the api, once per deployment per session, so it outlives this browser
 * and a search made against the api can match it.
 */
export function useDeploymentNameBackfill(apiNames: ReadonlyArray<ApiDeploymentName>, dependencies = DEPENDENCIES): void {
  const { api, deploymentLocalStorage, deploymentNameBackfill, logger } = dependencies.useServices();
  const queryClient = dependencies.useQueryClient();
  const address = useAtomValue(settingsIdAtom);
  const { mutateAsync: recordName } = api.v1.patchDeployment.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });

  const unnamedKey = toUnnamedKey(apiNames);

  useEffect(
    function recordNamesOnlyThisBrowserHolds() {
      if (!address || !unnamedKey) return;

      for (const dseq of unnamedKey.split(",")) {
        const name = deploymentLocalStorage.get(address, dseq)?.name?.trim().slice(0, MAX_DEPLOYMENT_NAME_LENGTH);

        if (!name) continue;

        deploymentNameBackfill.enqueue(dseq, () =>
          recordName({ dseq, data: { name } })
            .then(function refreshEverySurfaceShowingTheName() {
              queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) });
              queryClient.invalidateQueries({ queryKey: api.v1.listDeploymentNames.getKey() });
              queryClient.invalidateQueries({ queryKey: api.v1.listDeployments.getKey() });
            })
            .catch(function reportRefusedBackfill(error) {
              logger.warn({ event: "DEPLOYMENT_NAME_BACKFILL_FAILED", dseq, error });
            })
        );
      }
    },
    [unnamedKey, address, api, deploymentLocalStorage, deploymentNameBackfill, logger, queryClient, recordName]
  );
}
