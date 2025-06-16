import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import restClient from "@src/utils/restClient";

// Get user's API keys
export function useUserApiKeys() {
  return useQuery<ApiKeyResponse[]>({
    queryKey: ["API_KEYS"],
    queryFn: () => restClient.get("/v1/api-keys"),
    refetchOnWindowFocus: false
  });
}

// Delete API key
export function useDeleteApiKey(apiKeyId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => restClient.delete(`/v1/api-keys/${apiKeyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["API_KEYS"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "Failed to delete API key", {
        variant: "error"
      });
    }
  });
}

// Create API key
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => restClient.post("/v1/api-keys", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["API_KEYS"] });
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "Failed to create API key", {
        variant: "error"
      });
    }
  });
}
