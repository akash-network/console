import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import type { ApiKey, ApiKeyResponse } from "@src/types/apiKey";
import restClient from "@src/utils/restClient";

// Get user's API key
export function useUserApiKey() {
  return useQuery<ApiKey | null>({
    queryKey: ["API_KEY"],
    queryFn: async () => {
      try {
        const res: ApiKeyResponse = await restClient.get("/api-key");
        if (res && typeof res === "object" && res.api_key) {
          return {
            apiKey: res.api_key,
            createdAt: res.created_at,
            lastUsedAt: res.last_used_at,
            expiresAt: res.expires_at,
            isActive: res.is_active,
            walletAddress: res.wallet_address,
            id: res.id
          };
        }
        return null;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });
}

// Delete API key
export function useDeleteApiKey(apiKeyId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => restClient.delete(`/api-key/${apiKeyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["API_KEY"] });
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
    mutationFn: async () => {
      const res: ApiKeyResponse = await restClient.post("/api-key");
      return {
        apiKey: res.api_key,
        createdAt: res.created_at,
        lastUsedAt: res.last_used_at,
        expiresAt: res.expires_at,
        isActive: res.is_active,
        walletAddress: res.wallet_address,
        id: res.id
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["API_KEY"] });
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "Failed to create API key", {
        variant: "error"
      });
    }
  });
}
