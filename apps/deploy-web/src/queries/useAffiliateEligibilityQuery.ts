import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export type AffiliateEnrollmentEligibility = paths["/v1/affiliates/me/eligibility"]["get"]["responses"][200]["content"]["application/json"]["data"];

export const DEPENDENCIES = { useUser };

export function useAffiliateEligibilityQuery(options: { enabled?: boolean } = {}, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = useServices();
  const { user } = dependencies.useUser();

  return api.v1.getAffiliateEnrollmentEligibility.useQuery(undefined, {
    enabled: (options.enabled ?? true) && !!user?.userId,
    select: response => response.data
  });
}
