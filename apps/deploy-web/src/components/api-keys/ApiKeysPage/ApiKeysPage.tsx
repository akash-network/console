import { useState } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { BookOpenIcon, PlusIcon } from "lucide-react";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import { ApiKeyList } from "@src/components/api-keys/ApiKeyList/ApiKeyList";
import { ApiKeyUsageGuide } from "@src/components/api-keys/ApiKeyUsageGuide/ApiKeyUsageGuide";
import { CreateApiKeyDialog } from "@src/components/api-keys/CreateApiKeyDialog/CreateApiKeyDialog";
import { RevokeApiKeyDialog } from "@src/components/api-keys/RevokeApiKeyDialog/RevokeApiKeyDialog";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { useServices } from "@src/context/ServicesProvider";
import { useDeleteApiKey, useUserApiKeys } from "@src/queries/useApiKeysQuery";

export const API_REFERENCE_URL = "https://akash.network/docs/api-documentation/console-api/getting-started/";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  NextSeo,
  ApiKeyList,
  ApiKeyUsageGuide,
  CreateApiKeyDialog,
  RevokeApiKeyDialog,
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
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<ApiKeyResponse | null>(null);
  const { data: apiKeys, isLoading, isError } = d.useUserApiKeys();
  const { mutate: deleteApiKey, isPending: isRevoking } = d.useDeleteApiKey(apiKeyToRevoke?.id ?? "", () => {
    enqueueSnackbar(<Snackbar title={`“${apiKeyToRevoke?.name}” revoked`} iconVariant="success" />, { variant: "success" });
    setApiKeyToRevoke(null);
  });

  const revokeApiKey = () => {
    deleteApiKey(undefined, {
      onError: () => {
        enqueueSnackbar(<Snackbar title="Couldn't revoke the key" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
      }
    });

    analyticsService.track("delete_api_key", {
      category: "settings",
      label: "Delete API key"
    });
  };

  return (
    <d.Layout background="dots" isLoading={isLoading} disableContainer>
      <d.NextSeo title="API Keys" />

      <d.SettingsLayout
        title="API keys"
        headerActions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={API_REFERENCE_URL} target="_blank" rel="noopener noreferrer">
                <BookOpenIcon className="h-3.5 w-3.5" aria-hidden />
                API reference
              </a>
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setIsCreatingKey(true)}>
              <PlusIcon className="h-3.5 w-3.5" aria-hidden />
              Create new key
            </Button>
          </div>
        }
      >
        <d.ApiKeyList apiKeys={apiKeys} isLoading={isLoading} isError={isError} onRevoke={setApiKeyToRevoke} />
        <d.ApiKeyUsageGuide />
      </d.SettingsLayout>

      {isCreatingKey && <d.CreateApiKeyDialog onClose={() => setIsCreatingKey(false)} />}
      {apiKeyToRevoke && (
        <d.RevokeApiKeyDialog apiKey={apiKeyToRevoke} isRevoking={isRevoking} onConfirm={revokeApiKey} onCancel={() => setApiKeyToRevoke(null)} />
      )}
    </d.Layout>
  );
}
