import { useState } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { enqueueSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList";
import { Layout } from "@src/components/layout/Layout";
import { withAuth } from "@src/components/shared/withAuth";
import { useDeleteApiKey, useUserApiKeys } from "@src/queries/useApiKeysQuery";

const ApiKeysPage: React.FC = () => {
  const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKeyResponse | null>(null);
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useUserApiKeys();
  const { mutate: deleteApiKey, isPending: isDeleting } = useDeleteApiKey(apiKeyToDelete?.id ?? "", () => {
    setApiKeyToDelete(null);
    enqueueSnackbar("API Key deleted successfully", {
      variant: "success"
    });
  });
  const isLoading = isLoadingApiKeys || isDeleting;

  const onDeleteApiKey = () => {
    deleteApiKey();
  };

  const onDeleteClose = () => {
    setApiKeyToDelete(null);
  };

  return (
    <Layout isLoading={isLoading}>
      <ApiKeyList
        apiKeys={apiKeys}
        onDeleteApiKey={onDeleteApiKey}
        onDeleteClose={onDeleteClose}
        isDeleting={isDeleting}
        apiKeyToDelete={apiKeyToDelete}
        updateApiKeyToDelete={apiKey => setApiKeyToDelete(apiKey)}
      />
    </Layout>
  );
};

export default withAuth({ WrappedComponent: ApiKeysPage, authLevel: "provider" });
