import { useState } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { NextSeo } from "next-seo";
import { enqueueSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList";
import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { useDeleteApiKey, useUserApiKeys } from "@src/queries/useApiKeysQuery";

export default Guard(ApiKeysPage, useIsRegisteredUser);

function ApiKeysPage() {
  const { analyticsService } = useServices();
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

    analyticsService.track("delete_api_key", {
      category: "settings",
      label: "Delete API key"
    });
  };

  const onDeleteClose = () => {
    setApiKeyToDelete(null);
  };

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title="API Keys" />

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
}
