import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_HANDLED_BY_CALLER, SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

export function useAssistantPrivacyQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.getAssistantConsent.useQuery(undefined, { enabled, select: response => response.data, refetchOnWindowFocus: false });
}

export function useUpdateAssistantConsentMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateAssistantConsent.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: response => queryClient.setQueryData(api.v1.getAssistantConsent.getKey(), response)
  });
}

export function useDeleteAssistantConversationsMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteAssistantConversations.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.getAssistantConsent.getKey() })
  });
}

export function useStartAssistantConversationMutation() {
  const { api } = useServices();

  return api.v1.createAssistantConversation.useMutation({ meta: SKIP_REPORTING_HANDLED_BY_CALLER });
}

export function useEndAssistantConversationMutation() {
  const { api } = useServices();

  return api.v1.endAssistantConversation.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}

export function useRecordAssistantActionResultMutation() {
  const { api } = useServices();

  return api.v1.createAssistantActionResult.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}
