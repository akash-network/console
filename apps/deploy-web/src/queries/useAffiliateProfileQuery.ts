import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

export type AffiliateProfile = NonNullable<paths["/v1/affiliates/me"]["get"]["responses"][200]["content"]["application/json"]["data"]>;

export function useAffiliateProfileQuery(options: { enabled?: boolean } = {}) {
  const { api } = useServices();
  return api.v1.getAffiliateProfile.useQuery(undefined, {
    enabled: options.enabled ?? true,
    select: response => response.data
  });
}
