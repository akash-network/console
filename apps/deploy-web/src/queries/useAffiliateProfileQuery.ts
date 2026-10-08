import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export type AffiliateProfile = NonNullable<paths["/v1/affiliates/me"]["get"]["responses"][200]["content"]["application/json"]["data"]>;

export const DEPENDENCIES = { useUser };

/** Every caller gates on the signed-in user here, so an anonymous visit never fires the request no matter what each caller passes for `enabled`. */
export function useAffiliateProfileQuery(options: { enabled?: boolean } = {}, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = useServices();
  const { user } = dependencies.useUser();

  return api.v1.getAffiliateProfile.useQuery(undefined, {
    enabled: (options.enabled ?? true) && !!user?.userId,
    select: response => response.data
  });
}
