import { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList";
import { Layout } from "@src/components/layout/Layout";
import { withAuth } from "@src/components/shared/withAuth";
import { useCreateApiKey, useDeleteApiKey, useUserApiKey } from "@src/queries/useApiKeysQuery";
import type { ApiKey } from "@src/types/apiKey";

const ApiKeysPage: React.FC = () => {
  const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKey | null>(null);
  const { data: apiKey, isLoading: isLoadingApiKey } = useUserApiKey();
  const { mutate: deleteApiKey, isPending: isDeleting } = useDeleteApiKey(apiKeyToDelete?.id ?? "", () => {
    setApiKeyToDelete(null);
    enqueueSnackbar("API Key deleted successfully", {
      variant: "success"
    });
  });
  const { mutate: createApiKey, isPending: isCreating } = useCreateApiKey();
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const isLoading = isLoadingApiKey || isDeleting;

  const onDeleteApiKey = () => {
    deleteApiKey();
  };

  const onDeleteClose = () => {
    setApiKeyToDelete(null);
  };

  const onCreateApiKey = () => {
    createApiKey(undefined, {
      onSuccess: data => {
        enqueueSnackbar("API Key created successfully", { variant: "success" });
        setCreatedKey(data.apiKey);
      },
      onError: (error: any) => {
        enqueueSnackbar(error?.response?.data?.message || "Failed to create API key", { variant: "error" });
      }
    });
  };

  // Prefer showing the just-created key if present
  let displayApiKey = apiKey;
  if (createdKey) {
    if (apiKey) {
      displayApiKey = { ...apiKey, apiKey: createdKey };
    } else {
      // fallback: show just the key if no apiKey object yet
      displayApiKey = {
        apiKey: createdKey,
        createdAt: "",
        expiresAt: "",
        id: "",
        isActive: true,
        lastUsedAt: "",
        walletAddress: ""
      };
    }
  }

  // Clear createdKey after 5 seconds
  useEffect(() => {
    if (createdKey) {
      const timer = setTimeout(() => setCreatedKey(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [createdKey]);

  return (
    <Layout isLoading={isLoading}>
      <ApiKeyList
        apiKey={displayApiKey}
        onDeleteApiKey={onDeleteApiKey}
        onDeleteClose={onDeleteClose}
        isDeleting={isDeleting}
        apiKeyToDelete={apiKeyToDelete}
        updateApiKeyToDelete={apiKey => setApiKeyToDelete(apiKey)}
        onCreateApiKey={onCreateApiKey}
        isCreating={isCreating}
      />
    </Layout>
  );
};

export default withAuth({ WrappedComponent: ApiKeysPage, authLevel: "provider" });
