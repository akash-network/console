import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export type Referral = NonNullable<paths["/v1/referral"]["get"]["responses"][200]["content"]["application/json"]["data"]>;

export const DEPENDENCIES = { useUser };

/** Every caller gates on the signed-in user here, so an anonymous visit never fires the request no matter what each caller passes for `enabled`. */
export function useReferralQuery(options: { enabled?: boolean } = {}, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = useServices();
  const { user } = dependencies.useUser();

  return api.v1.getReferral.useQuery(undefined, {
    enabled: (options.enabled ?? true) && !!user?.userId,
    select: response => response.data
  });
}
