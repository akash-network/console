import { useState } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { useServices } from "@src/context/ServicesProvider";
import { useDeleteApiKey, useUserApiKeys } from "@src/queries/useApiKeysQuery";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  NextSeo,
  ApiKeyList,
  useUserApiKeys,
  useDeleteApiKey,
  useSnackbar
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function ApiKeysPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKeyResponse | null>(null);
  const { data: apiKeys, isLoading: isLoadingApiKeys } = d.useUserApiKeys();
  const { mutate: deleteApiKey, isPending: isDeleting } = d.useDeleteApiKey(apiKeyToDelete?.id ?? "", () => {
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
    <d.Layout isLoading={isLoading} disableContainer>
      <d.NextSeo title="API Keys" />

      <d.SettingsLayout>
        <d.ApiKeyList
          apiKeys={apiKeys}
          onDeleteApiKey={onDeleteApiKey}
          onDeleteClose={onDeleteClose}
          isDeleting={isDeleting}
          apiKeyToDelete={apiKeyToDelete}
          updateApiKeyToDelete={apiKey => setApiKeyToDelete(apiKey)}
        />
      </d.SettingsLayout>
    </d.Layout>
  );
}
