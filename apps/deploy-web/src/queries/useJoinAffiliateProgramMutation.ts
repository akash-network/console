import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

/** The profile is written to the cache first because the eligibility endpoint answers "not eligible" for an enrolled caller, which would redirect them away. */
export function useJoinAffiliateProgramMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.joinAffiliateProgram.useMutation({
    onSuccess: response => {
      const profileKey = api.v1.getAffiliateProfile.getKey();
      queryClient.setQueryData(profileKey, response);
      return queryClient.invalidateQueries({ queryKey: profileKey });
    }
  });
}
