import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

export function useFeedbackOutcomePromptQuery(dseq: string, { enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.getFeedbackOutcomePrompt.useQuery({ dseq }, { enabled, select: response => response.data, refetchOnWindowFocus: false });
}

export function useCreateFeedbackMutation() {
  const { api } = useServices();

  return api.v1.createFeedback.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}
