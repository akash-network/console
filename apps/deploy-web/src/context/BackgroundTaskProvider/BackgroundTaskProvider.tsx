"use client";
import React from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import FileSaver from "file-saver";
import { useSnackbar } from "notistack";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { ProviderInfo } from "@src/hooks/useProviderWebsocket";
import networkStore from "@src/store/networkStore";
import { useCertificate } from "../CertificateProvider";

const getPrintCommand = (os: string) => {
  switch (os) {
    case "linux":
    case "macos":
      return "cat";

    case "windows":
      return "type";

    default:
      return "cat";
  }
};

type ContextType = {
  downloadLogs: (provider: ProviderInfo, dseq: string, gseq: number, oseq: number, isLogs: boolean) => Promise<void>;
  downloadFileFromShell: (provider: ProviderInfo, dseq: string, gseq: number, oseq: number, service: string, filePath: string) => Promise<void>;
};

const BackgroundTaskContext = React.createContext<ContextType>({} as ContextType);

export const BackgroundTaskProvider = ({ children }) => {
  const { localCert } = useCertificate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const chainNetwork = networkStore.useSelectedNetworkId();

  function downloadMessages(options: DownloadMessagesOptions): Promise<DownloadMessagesResult> {
    return new Promise(resolve => {
      const ws = new WebSocket(browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL_WS);
      const state = { isCancelled: false, isFinished: false };

      function onCancel() {
        state.isCancelled = true;
        ws.close();

        closeSnackbar(snackbarKey);
      }
      const snackbarKey = enqueueSnackbar(
        <Snackbar
          title={options.title}
          subTitle={
            <Button onClick={onCancel} variant="text" size="sm">
              Cancel
            </Button>
          }
          showLoading
        />,
        { variant: "info", persist: true, action: () => null }
      );

      ws.onmessage = event => {
        try {
          options.onMessage(event, state, ws);
        } catch (error) {
          console.log(error);
          ws.close();
        }
      };
      ws.onclose = () => {
        if (state.isCancelled) {
          resolve({ ok: false, code: "cancelled" });
        } else if (state.isFinished) {
          closeSnackbar(snackbarKey);
          resolve({ ok: true });
        } else {
          closeSnackbar(snackbarKey);
          enqueueSnackbar("Failed to download logs", { variant: "error" });
          resolve({ ok: false, code: "unknown" });
        }
      };
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "websocket",
            url: options.url,
            certPem: localCert?.certPem,
            keyPem: localCert?.keyPem,
            chainNetwork,
            providerAddress: options.providerAddress
          })
        );
      };
      options.start?.(state, ws);
    });
  }

  const downloadLogs: ContextType["downloadLogs"] = async (provider, dseq, gseq, oseq, isLogs) => {
    const url = isLogs
      ? `${provider.hostUri}/lease/${dseq}/${gseq}/${oseq}/logs?follow=false&tail=10000000`
      : `${provider.hostUri}/lease/${dseq}/${gseq}/${oseq}/kubeevents?follow=false&tail=10000000`;
    let logFileContent = "";
    let lastMessageTimestamp = Date.now();
    const result = await downloadMessages({
      url,
      title: isLogs ? "Downloading logs..." : "Downloading events...",
      providerAddress: provider.owner,
      start(state, ws) {
        setInterval(() => {
          const elapsed = Date.now() - lastMessageTimestamp;

          if (elapsed > 3_000) {
            state.isFinished = true;
            ws.close();
          }
        }, 1_000);
      },
      onMessage(event) {
        const data = JSON.parse(event.data);
        if (data.closed || !data.message) return;

        const parsedLog = JSON.parse(data.message);

        let service: string;
        let message: string;
        if (isLogs) {
          service = parsedLog?.name ? parsedLog?.name.split("-")[0] : "";
          message = `[${service}]: ${parsedLog.message}`;
        } else {
          service = parsedLog.object?.name ? parsedLog.object?.name.split("-")[0] : "";
          message = `[${service}]: [${parsedLog.type}] [${parsedLog.reason}] [${parsedLog.object?.kind}] ${parsedLog.note}`;
        }

        logFileContent += message + "\n";
        lastMessageTimestamp = Date.now();
      }
    });

    if (!result.ok) {
      if (result.code === "cancelled") {
        console.log("cancelled");
      } else {
        console.log("failed to download logs");
      }
    }

    const fileName = `${dseq}-${gseq}-${oseq}-logs-${new Date().toISOString().substring(0, 10)}.txt`;
    FileSaver.saveAs(new Blob([logFileContent]), fileName);
  };

  const downloadFileFromShell: ContextType["downloadFileFromShell"] = async (provider, dseq, gseq, oseq, service, filePath) => {
    const printCommand = getPrintCommand("linux");
    const command = `${printCommand} ${filePath}`;
    const url = `${provider.hostUri}/lease/${dseq}/${gseq}/${oseq}/shell?stdin=0&tty=0&podIndex=0${command
      .split(" ")
      .map((c, i) => `&cmd${i}=${encodeURIComponent(c.replace(" ", "+"))}`)
      .join("")}${`&service=${service}`}`;

    let fileContent: Buffer | null = null;

    const result = await downloadMessages({
      title: `Downloading ${filePath}...`,
      url,
      providerAddress: provider.owner,
      onMessage(event, state, ws) {
        let exitCode: unknown;
        let errorMessage: unknown;
        const message = JSON.parse(event.data).message;

        const bufferData = Buffer.from(message.data.slice(1));
        const stringData = bufferData.toString("utf-8").replace(/^\n|\n$/g, "");

        try {
          const jsonData = JSON.parse(stringData);
          exitCode = jsonData["exit_code"];
          errorMessage = jsonData["message"];
        } catch {
          /* empty */
        }

        if (exitCode !== undefined) {
          if (errorMessage) {
            console.error(`An error has occured: ${errorMessage}`);
          } else if (fileContent === null) {
            console.log("File content null");
          } else {
            console.log("Download done: " + fileContent.length);
            state.isFinished = true;
          }

          ws.close();
        } else {
          if (!fileContent) {
            console.log("Starting new buffer");
            fileContent = bufferData;
          } else {
            console.log("Appending to buffer");
            fileContent = Buffer.concat([fileContent, bufferData]);
          }
        }
      }
    });

    if (!result.ok) {
      if (result.code === "cancelled") {
        console.log("cancelled");
      } else {
        console.log("failed to download shell file");
      }
    }

    if (fileContent) {
      console.log("Done, downloading file");
      const filename = filePath.replace(/^.*[\\/]/, "");
      FileSaver.saveAs(new Blob([fileContent!]), filename);
    } else {
      console.error("failed to download shell file: file content is empty");
    }
  };

  return (
    <BackgroundTaskContext.Provider
      value={{
        downloadLogs,
        downloadFileFromShell
      }}
    >
      {children}
    </BackgroundTaskContext.Provider>
  );
};

export const useBackgroundTask = () => {
  return { ...React.useContext(BackgroundTaskContext) };
};

interface DownloadMessagesOptions {
  title: string;
  url: string;
  providerAddress: string;
  onMessage(event: MessageEvent<string>, state: DownloadState, ws: WebSocket): void;
  start?(state: DownloadState, ws: WebSocket): void;
}

interface DownloadState {
  isFinished: boolean;
  isCancelled: boolean;
}

type DownloadMessagesResult = { ok: false; code: "cancelled" | "unknown" } | { ok: true };
