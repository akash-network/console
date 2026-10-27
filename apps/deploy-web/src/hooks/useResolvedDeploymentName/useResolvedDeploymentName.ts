import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = { useServices };

/** A deployment's name as the console api holds it. */
export function useResolvedDeploymentName(dseq: string | undefined | null, dependencies = DEPENDENCIES): string | undefined {
  const { api } = dependencies.useServices();

  const query = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: !!dseq,
      /** A server fault is reported like any other; a refusal or an offline browser is neither a bug nor a reason to fail the view. */
      catchError(error) {
        if (error instanceof ApiError && error.status >= 500) throw error;
        return null;
      }
    }
  );

  return query.data?.data.name ?? undefined;
}
