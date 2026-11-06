import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useServices, useQueryClient, useAtomValue };

/** Renames a deployment the way the rename dialog does: a name backfill already writing it settles first, so the older name cannot land last. */
export function useRenameDeployment(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api, deploymentNameBackfill } = dependencies.useServices();
  const queryClient = dependencies.useQueryClient();
  const owner = dependencies.useAtomValue(settingsIdAtom);
  const { mutateAsync: patchDeployment } = api.v1.patchDeployment.useMutation();

  return useCallback(
    async (dseq: string, name: string) => {
      if (owner) await deploymentNameBackfill.preempt(owner, dseq);
      await patchDeployment({ dseq, data: { name } });

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listDeploymentNames.getKey() }),
        queryClient.invalidateQueries({ queryKey: api.v1.listDeployments.getKey() })
      ]);
    },
    [owner, deploymentNameBackfill, patchDeployment, queryClient, api]
  );
}
