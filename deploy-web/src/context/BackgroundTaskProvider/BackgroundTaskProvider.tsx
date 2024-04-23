"use client";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import React from "react";
import { useCertificate } from "../CertificateProvider";
import FileSaver from "file-saver";
import { useToast } from "@src/components/ui/use-toast";
import { Button } from "@src/components/ui/button";

const getPrintCommand = os => {
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
  downloadLogs: (hostUri: string, dseq: string, gseq: number, oseq: number, isLogs: boolean) => void;
  downloadFileFromShell: (hostUri: string, dseq: string, gseq: number, oseq: number, service: string, filePath: string) => void;
};

const BackgroundTaskContext = React.createContext<ContextType>({} as ContextType);

export const BackgroundTaskProvider = ({ children }) => {
  const { localCert } = useCertificate();
  const { toast, dismiss } = useToast();

  const downloadLogs = async (hostUri: string, dseq: string, gseq: number, oseq: number, isLogs: boolean) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(PROVIDER_PROXY_URL_WS);
      let isCancelled = false;
      let isFinished = false;
      let snackbarKey: string;

      function onCancel() {
        isCancelled = true;
        ws.close();

        dismiss(snackbarKey);
      }
      const { id } = toast({
        title: isLogs ? "Downloading logs..." : "Downloading events...",
        description: (
          <Button onClick={onCancel} variant="text" size="sm">
            Cancel
          </Button>
        ),
        loading: true
      });
      snackbarKey = id;

      const url = isLogs
        ? `${hostUri}/lease/${dseq}/${gseq}/${oseq}/logs?follow=false&tail=10000000`
        : `${hostUri}/lease/${dseq}/${gseq}/${oseq}/kubeevents?follow=false&tail=10000000`;
      let logFileContent = "";
      let lastMessageTimestamp = Date.now();

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data).message;
          const parsedLog = JSON.parse(data);
          let service: string, message: string;
          if (isLogs) {
            service = parsedLog?.name ? parsedLog?.name.split("-")[0] : "";
            message = `[${service}]: ${parsedLog.message}`;
          } else {
            service = parsedLog.object?.name ? parsedLog.object?.name.split("-")[0] : "";
            message = `[${service}]: [${parsedLog.type}] [${parsedLog.reason}] [${parsedLog.object?.kind}] ${parsedLog.note}`;
          }

          logFileContent += message + "\n";
          lastMessageTimestamp = Date.now();
        } catch (error) {
          console.log(error);
        }
      };

      ws.onclose = () => {
        if (isCancelled) {
          console.log("Cancelled");
          resolve(true);
        } else if (isFinished) {
          dismiss(snackbarKey);
          console.log("Done, downloading file");
          const fileName = `${dseq}-${gseq}-${oseq}-logs-${new Date().toISOString().substring(0, 10)}.txt`;
          FileSaver.saveAs(new Blob([logFileContent]), fileName);
          resolve(true);
        } else {
          console.log("No logs / Failed");
          dismiss(snackbarKey);
          toast({ title: "Failed to download logs", variant: "destructive" });
          reject("Failed to download logs");
        }
      };
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "websocket",
            url: url,
            certPem: localCert?.certPem,
            keyPem: localCert?.keyPem
          })
        );
      };

      setInterval(() => {
        const elapsed = Date.now() - lastMessageTimestamp;

        if (elapsed > 3_000) {
          isFinished = true;
          ws.close();
        }
      }, 1_000);
    });
  };

  const downloadFileFromShell = async (hostUri: string, dseq: string, gseq: number, oseq: number, service: string, filePath: string) => {
    const ws = new WebSocket(PROVIDER_PROXY_URL_WS);
    let isCancelled = false;
    let isFinished = false;
    let snackbarKey: string;

    function onCancel() {
      isCancelled = true;
      ws.close();

      dismiss(snackbarKey);
    }
    const { id } = toast({
      title: `Downloading ${filePath}...`,
      description: (
        <Button onClick={onCancel} variant="text" size="sm">
          Cancel
        </Button>
      ),
      loading: true
    });
    snackbarKey = id;

    const printCommand = getPrintCommand("linux");
    const command = `${printCommand} ${filePath}`;
    const url = `${hostUri}/lease/${dseq}/${gseq}/${oseq}/shell?stdin=0&tty=0&podIndex=0${command
      .split(" ")
      .map((c, i) => `&cmd${i}=${encodeURIComponent(c.replace(" ", "+"))}`)
      .join("")}${`&service=${service}`}`;

    let fileContent: Buffer | null = null;

    ws.onmessage = event => {
      let exitCode, errorMessage;
      try {
        const message = JSON.parse(event.data).message;

        const bufferData = Buffer.from(message.data.slice(1));
        const stringData = bufferData.toString("utf-8").replace(/^\n|\n$/g, "");

        try {
          const jsonData = JSON.parse(stringData);
          exitCode = jsonData["exit_code"];
          errorMessage = jsonData["message"];
        } catch (err) {}

        if (exitCode !== undefined) {
          if (errorMessage) {
            console.error(`An error has occured: ${errorMessage}`);
          } else if (fileContent === null) {
            console.log("File content null");
          } else {
            console.log("Download done: " + fileContent.length);
            isFinished = true;
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
      } catch (error) {
        console.log(error);
        ws.close();
      }
    };

    ws.onclose = () => {
      if (isCancelled) {
        console.log("Cancelled");
      } else if (isFinished && fileContent) {
        dismiss(snackbarKey);
        console.log("Done, downloading file");
        const filename = filePath.replace(/^.*[\\\/]/, "");
        FileSaver.saveAs(new Blob([fileContent]), filename);
      } else {
        console.log("No file / Failed");
        dismiss(snackbarKey);
        toast({ title: "Failed to download file", variant: "destructive" });
      }
    };
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "websocket",
          url: url,
          certPem: localCert?.certPem,
          keyPem: localCert?.keyPem
        })
      );
    };
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
