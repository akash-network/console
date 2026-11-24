import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export function useJoinAffiliateProgramMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.joinAffiliateProgram.useMutation({
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.getAffiliateProfile.getKey() }),
        queryClient.invalidateQueries({ queryKey: api.v1.getAffiliateEnrollmentEligibility.getKey() })
      ])
  });
}
