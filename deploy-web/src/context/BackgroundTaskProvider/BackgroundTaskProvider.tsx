import { Button } from "@mui/material";
import { Snackbar } from "@src/components/shared/Snackbar";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import { useSnackbar } from "notistack";
import React from "react";
import { useCertificate } from "../CertificateProvider";
import FileSaver from "file-saver";

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
  downloadLogs: (hostUri: string, dseq: string, gseq: string, oseq: string, isLogs: boolean) => void;
  downloadFileFromShell: (hostUri: string, dseq: string, gseq: string, oseq: string, service: string, filePath: string) => void;
};

const BackgroundTaskContext = React.createContext<ContextType>({
  downloadLogs: null,
  downloadFileFromShell: null
});

export const BackgroundTaskProvider = ({ children }) => {
  const { localCert } = useCertificate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const downloadLogs = async (hostUri: string, dseq: string, gseq: string, oseq: string, isLogs: boolean) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(PROVIDER_PROXY_URL_WS);
      let isCancelled = false;
      let isFinished = false;

      function onCancel() {
        isCancelled = true;
        ws.close();

        closeSnackbar(snackbarKey);
      }
      const snackbarKey = enqueueSnackbar(
        <Snackbar
          title={isLogs ? "Downloading logs..." : "Downloading events..."}
          subTitle={
            <Button onClick={onCancel} variant="text" color="primary" size="small">
              Cancel
            </Button>
          }
          showLoading
        />,
        { variant: "info", persist: true, action: key => null }
      );

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
          closeSnackbar(snackbarKey);
          console.log("Done, downloading file");
          const fileName = `${dseq}-${gseq}-${oseq}-logs-${new Date().toISOString().substring(0, 10)}.txt`;
          FileSaver.saveAs(new Blob([logFileContent]), fileName);
          resolve(true);
        } else {
          console.log("No logs / Failed");
          closeSnackbar(snackbarKey);
          enqueueSnackbar("Failed to download logs", { variant: "error" });
          reject("Failed to download logs");
        }
      };
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "websocket",
            url: url,
            certPem: localCert.certPem,
            keyPem: localCert.keyPem
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

  const downloadFileFromShell = async (hostUri: string, dseq: string, gseq: string, oseq: string, service: string, filePath: string) => {
    const ws = new WebSocket(PROVIDER_PROXY_URL_WS);
    let isCancelled = false;
    let isFinished = false;

    function onCancel() {
      isCancelled = true;
      ws.close();

      closeSnackbar(snackbarKey);
    }
    const snackbarKey = enqueueSnackbar(
      <Snackbar
        title={`Downloading ${filePath}...`}
        subTitle={
          <Button onClick={onCancel} variant="contained" color="primary" size="small">
            Cancel
          </Button>
        }
        showLoading
      />,
      { variant: "info", persist: true, action: key => null }
    );

    const printCommand = getPrintCommand("linux");
    const command = `${printCommand} ${filePath}`;
    const url = `${hostUri}/lease/${dseq}/${gseq}/${oseq}/shell?stdin=0&tty=0&podIndex=0${command
      .split(" ")
      .map((c, i) => `&cmd${i}=${encodeURIComponent(c.replace(" ", "+"))}`)
      .join("")}${`&service=${service}`}`;

    let fileContent: Buffer | null = null;

    ws.onmessage = event => {
      let jsonData, exitCode, errorMessage;
      try {
        const message = JSON.parse(event.data).message;

        const bufferData = Buffer.from(message.data.slice(1));
        const stringData = bufferData.toString("utf-8").replace(/^\n|\n$/g, "");

        jsonData = JSON.parse(stringData);
        exitCode = jsonData["exit_code"];
        errorMessage = jsonData["message"];

        if (exitCode !== undefined) {
          if (errorMessage) {
            console.error(`An error has occured: ${errorMessage}`);
          }
          console.log("Download done: " + fileContent.length);

          isFinished = true;
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
      }
    };

    ws.onclose = () => {
      if (isCancelled) {
        console.log("Cancelled");
      } else if (isFinished) {
        closeSnackbar(snackbarKey);
        console.log("Done, downloading file");
        const filename = filePath.replace(/^.*[\\\/]/, "");
        FileSaver.saveAs(new Blob([fileContent]), filename);
      } else {
        console.log("No file / Failed");
        closeSnackbar(snackbarKey);
        enqueueSnackbar("Failed to download logs", { variant: "error" });
      }
    };
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "websocket",
          url: url,
          certPem: localCert.certPem,
          keyPem: localCert.keyPem
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
