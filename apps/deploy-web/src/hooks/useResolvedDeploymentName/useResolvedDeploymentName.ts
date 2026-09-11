import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";

export const DEPENDENCIES = { useServices, useWallet };

/** A deployment's name as the console api holds it, falling back to this browser's own record only where the api holds none. */
export function useResolvedDeploymentName(dseq: string | undefined | null, dependencies = DEPENDENCIES): string | undefined {
  const { api, deploymentLocalStorage } = dependencies.useServices();
  const { address } = dependencies.useWallet();

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
