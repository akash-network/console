import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import type { Notification, NotificationDraft, NotificationDraftInput, NotificationListResponse, SendNotificationResponse } from "@src/types/notification";
import restClient from "@src/utils/restClient";

// Get provider ID from context or URL params
const getProviderId = (): string => {
  // This should be replaced with actual provider ID from context
  // For now, we'll assume it's available in the URL or context
  if (typeof window !== "undefined") {
    const pathParts = window.location.pathname.split("/");
    const providerIndex = pathParts.indexOf("providers");
    if (providerIndex !== -1 && pathParts[providerIndex + 1]) {
      return pathParts[providerIndex + 1];
    }
  }
  throw new Error("Provider ID not found");
};

// Create notification draft
export function useCreateNotificationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: NotificationDraftInput): Promise<NotificationDraft> => {
      const providerId = getProviderId();
      const response: NotificationDraft = await restClient.post(`/providers/${providerId}/notifications`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      enqueueSnackbar("Notification draft created successfully", {
        variant: "success"
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to create notification draft";
      enqueueSnackbar(message, { variant: "error" });
    }
  });
}

// Send notification
export function useSendNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string): Promise<SendNotificationResponse> => {
      const providerId = getProviderId();
      const idempotencyKey = crypto.randomUUID();
      const response: SendNotificationResponse = await restClient.post(
        `/providers/${providerId}/notifications/${notificationId}/send`,
        {},
        {
          headers: {
            "Idempotency-Key": idempotencyKey
          }
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      enqueueSnackbar("Notification queued for delivery", {
        variant: "success"
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to send notification";
      enqueueSnackbar(message, { variant: "error" });
    }
  });
}

// List notifications
export function useNotifications(page = 1, pageSize = 20, status = "any") {
  return useQuery<NotificationListResponse>({
    queryKey: ["notifications", page, pageSize, status],
    queryFn: async () => {
      const providerId = getProviderId();
      const response: NotificationListResponse = await restClient.get(
        `/providers/${providerId}/notifications?page=${page}&page_size=${pageSize}&status=${status}`
      );
      return response;
    },
    refetchOnWindowFocus: false
  });
}

// Get single notification
export function useNotification(notificationId: string) {
  return useQuery<Notification>({
    queryKey: ["notification", notificationId],
    queryFn: async () => {
      const providerId = getProviderId();
      const response: Notification = await restClient.get(`/providers/${providerId}/notifications/${notificationId}`);
      return response;
    },
    enabled: !!notificationId,
    refetchOnWindowFocus: false
  });
}
