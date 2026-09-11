import { ApiError } from "@akashnetwork/openapi-sdk";
import { useAtomValue } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useServices };

/** A deployment's name as the console api holds it, falling back to this browser's own record only where the api holds none. */
export function useResolvedDeploymentName(dseq: string | undefined | null, dependencies = DEPENDENCIES): string | undefined {
  const { api, deploymentLocalStorage } = dependencies.useServices();
  /** Read from the store rather than `useWallet`, since the rename dialog mounts outside the wallet provider and would resolve no address there at all. */
  const address = useAtomValue(settingsIdAtom);

  const query = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: !!dseq,
      /** A server fault is reported like any other; a refusal or an offline browser is neither a bug nor a reason to leave a named deployment unnamed. */
      catchError(error) {
        if (error instanceof ApiError && error.status >= 500) throw error;
        return null;
      }
    }
  );

  return query.data?.data.name ?? deploymentLocalStorage.get(address, dseq)?.name;
}
