"use client";
import { useCallback, useMemo } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderInfo } from "@src/hooks/useProviderWebsocket";
import type { DownloadMessagesResult } from "@src/services/provider-proxy/provider-proxy.service";
import networkStore from "@src/store/networkStore";

type ProviderApiActions = {
  downloadLogs: (provider: ProviderInfo, dseq: string, gseq: number, oseq: number, isLogs: boolean) => Promise<void>;
  downloadFileFromShell: (provider: ProviderInfo, dseq: string, gseq: number, oseq: number, service: string, filePath: string) => Promise<void>;
};

// TODO: ideally this should be merged together with useProviderWebsocket hook
// but it depends on useWebsocket hook which immediately connects the websocket
// and we don't want to connect the websocket unnecessarily
export const useProviderApiActions = (): ProviderApiActions => {
  const providerCredentials = useProviderCredentials();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const chainNetwork = networkStore.useSelectedNetworkId();
  const { providerProxy } = useServices();

  const showSnackbar = useCallback(
    (title: string) => {
      const abortController = new AbortController();
      const snackbarKey = enqueueSnackbar(
        <Snackbar
          title={title}
          subTitle={
            <Button onClick={() => abortController.abort()} variant="text" size="sm">
              Cancel
            </Button>
          }
          showLoading
        />,
        { variant: "info", persist: true, action: () => null }
      );
      return { snackbarKey, abortController };
    },
    [enqueueSnackbar]
  );

  const displayResult = useCallback(
    (errorMessage: string, result: DownloadMessagesResult) => {
      if (!result.ok && result.code !== "cancelled") {
        const message = result.message ? `${errorMessage}:\n${result.message}` : errorMessage;
        enqueueSnackbar(message, { variant: "error" });
      }
    },
    [enqueueSnackbar]
  );

  const downloadLogs: ProviderApiActions["downloadLogs"] = useCallback(
    async (provider, dseq, gseq, oseq, isLogs) => {
      const { snackbarKey, abortController } = showSnackbar(isLogs ? "Downloading logs..." : "Downloading events...");
      const result = await providerProxy.downloadLogs({
        providerBaseUrl: provider.hostUri,
        providerAddress: provider.owner,
        providerCredentials: providerCredentials.details,
        chainNetwork,
        dseq,
        gseq,
        oseq,
        type: isLogs ? "logs" : "events",
        signal: abortController.signal
      });
      closeSnackbar(snackbarKey);
      displayResult(isLogs ? "Failed to download logs" : "Failed to download events", result);
    },
    [providerCredentials.details, chainNetwork, providerProxy, showSnackbar, closeSnackbar]
  );

  const downloadFileFromShell: ProviderApiActions["downloadFileFromShell"] = useCallback(
    async (provider, dseq, gseq, oseq, service, filePath) => {
      const { snackbarKey, abortController } = showSnackbar(`Downloading ${filePath}...`);
      const result = await providerProxy.downloadFileFromShell({
        providerBaseUrl: provider.hostUri,
        providerAddress: provider.owner,
        providerCredentials: providerCredentials.details,
        chainNetwork,
        dseq,
        gseq,
        oseq,
        service,
        filePath,
        signal: abortController.signal
      });
      closeSnackbar(snackbarKey);
      displayResult(`Failed to download file from shell`, result);
    },
    [providerCredentials.details, chainNetwork, providerProxy, showSnackbar, closeSnackbar]
  );

  return useMemo(
    () => ({
      downloadLogs,
      downloadFileFromShell
    }),
    [downloadLogs, downloadFileFromShell]
  );
};
