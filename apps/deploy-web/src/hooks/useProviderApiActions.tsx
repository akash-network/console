"use client";
import { useCallback, useMemo } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { DownloadMessagesResult } from "@src/services/provider-proxy/provider-proxy.service";
import type { ApiProviderList } from "@src/types/provider";

export type ProviderInfo = Pick<ApiProviderList, "owner" | "hostUri">;

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
  const { providerProxy, logger } = useServices();

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

      try {
        const result = await providerProxy.downloadLogs({
          providerBaseUrl: provider.hostUri,
          providerAddress: provider.owner,
          providerCredentials: providerCredentials.details,
          dseq,
          gseq,
          oseq,
          type: isLogs ? "logs" : "events",
          signal: abortController.signal
        });
        displayResult(isLogs ? "Failed to download logs" : "Failed to download events", result);
      } catch (error) {
        logger.error({ event: "DOWNLOAD_LOGS_ERROR", error });
        displayResult(isLogs ? "Failed to download logs" : "Failed to download events", {
          ok: false,
          code: "unknown",
          message: "Unexpected error. Could not connect to provider."
        });
      } finally {
        closeSnackbar(snackbarKey);
      }
    },
    [providerCredentials.details, providerProxy, showSnackbar, closeSnackbar, displayResult]
  );

  const downloadFileFromShell: ProviderApiActions["downloadFileFromShell"] = useCallback(
    async (provider, dseq, gseq, oseq, service, filePath) => {
      const { snackbarKey, abortController } = showSnackbar(`Downloading ${filePath}...`);
      try {
        const result = await providerProxy.downloadFileFromShell({
          providerBaseUrl: provider.hostUri,
          providerAddress: provider.owner,
          providerCredentials: providerCredentials.details,
          dseq,
          gseq,
          oseq,
          service,
          filePath,
          signal: abortController.signal
        });
        displayResult(`Failed to download file from shell`, result);
      } catch (error) {
        logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error });
        displayResult(`Failed to download file from shell`, {
          ok: false,
          code: "unknown",
          message: "Unexpected error. Could not connect to provider."
        });
      } finally {
        closeSnackbar(snackbarKey);
      }
    },
    [providerCredentials.details, providerProxy, showSnackbar, closeSnackbar, displayResult]
  );

  return useMemo(
    () => ({
      downloadLogs,
      downloadFileFromShell
    }),
    [downloadLogs, downloadFileFromShell]
  );
};
