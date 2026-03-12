import { useState } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { NextSeo } from "next-seo";
import { enqueueSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList";
import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useDeleteApiKey, useUserApiKeys } from "@src/queries/useApiKeysQuery";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  ApiKeyList,
  useUserApiKeys,
  useDeleteApiKey,
  enqueueSnackbar
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function ApiKeysPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { analyticsService } = useServices();
  const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKeyResponse | null>(null);
  const { data: apiKeys, isLoading: isLoadingApiKeys } = d.useUserApiKeys();
  const { mutate: deleteApiKey, isPending: isDeleting } = d.useDeleteApiKey(apiKeyToDelete?.id ?? "", () => {
    setApiKeyToDelete(null);
    d.enqueueSnackbar("API Key deleted successfully", {
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
    <d.Layout isLoading={isLoading}>
      <d.NextSeo title="API Keys" />

      <d.ApiKeyList
        apiKeys={apiKeys}
        onDeleteApiKey={onDeleteApiKey}
        onDeleteClose={onDeleteClose}
        isDeleting={isDeleting}
        apiKeyToDelete={apiKeyToDelete}
        updateApiKeyToDelete={apiKey => setApiKeyToDelete(apiKey)}
      />
    </d.Layout>
  );
}
