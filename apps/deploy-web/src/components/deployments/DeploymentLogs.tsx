"use client";
import { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";
import { Monaco } from "@monaco-editor/react";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Download, MoreHoriz } from "iconoir-react";
import { editor } from "monaco-editor";
import { event } from "nextjs-google-analytics";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { MemoMonaco } from "@src/components/shared/MemoMonaco";
import { SelectCheckbox } from "@src/components/shared/SelectCheckbox";
import Spinner from "@src/components/shared/Spinner";
import ViewPanel from "@src/components/shared/ViewPanel";
import { Alert } from "@src/components/ui/alert";
import { Button } from "@src/components/ui/button";
import { Checkbox, CheckboxWithLabel } from "@src/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@src/components/ui/dropdown-menu";
import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";
import { useCertificate } from "@src/context/CertificateProvider";
import { useThrottledCallback } from "@src/hooks/useThrottle";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { LeaseDto } from "@src/types/deployment";
import { AnalyticsEvents } from "@src/utils/analytics";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import { LeaseSelect } from "./LeaseSelect";

export type LOGS_MODE = "logs" | "events";

type Props = {
  leases: Array<LeaseDto> | null | undefined;
  selectedLogsMode: LOGS_MODE;
};

export const DeploymentLogs: React.FunctionComponent<Props> = ({ leases, selectedLogsMode }) => {
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [canSetConnection, setCanSetConnection] = useState(false);
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  // TODO Type
  const logs = useRef<any[]>([]);
  const [logText, setLogText] = useState("");
  const [isDownloadingLogs, setIsDownloadingLogs] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [selectedLease, setSelectedLease] = useState<LeaseDto | null>(null);
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, isCreatingCert, createCertificate } = useCertificate();
  const { downloadLogs } = useBackgroundTask();
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus(providerInfo?.hostUri || "", selectedLease as LeaseDto, {
    enabled: false
  });
  const { sendJsonMessage } = useWebSocket(PROVIDER_PROXY_URL_WS, {
    onOpen: () => {},
    onMessage: onLogReceived,
    onError: error => console.error("error", error),
    shouldReconnect: () => {
      return true;
    }
  });
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
    // here is another way to get monaco instance
    // you can also store it in `useRef` for further usage
    monacoEditorRef.current = editor;
    monacoRef.current = monaco;
  }

  useEffect(() => {
    if (monacoEditorRef.current) {
      const editor = monacoEditorRef.current;

      editor.onDidScrollChange(event => {
        // TODO Verify
        if (event.scrollTop < (event as any)._oldScrollTop) {
          setStickToBottom(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monacoEditorRef.current]);

  useEffect(() => {
    // Set the services and default selected services
    if (leaseStatus) {
      setServices(Object.keys(leaseStatus.services));
      // Set all services as default
      setSelectedServices(Object.keys(leaseStatus.services));

      setCanSetConnection(true);
    }
  }, [leaseStatus]);

  const updateLogText = useThrottledCallback(
    () => {
      const logText = logs.current.map(x => x.message).join("\n");
      setLogText(logText);
      setIsLoadingLogs(false);
    },
    [],
    1000
  );

  useEffect(() => {
    if (!leases || leases.length === 0) return;

    setSelectedLease(leases[0]);
  }, [leases]);

  useEffect(() => {
    if (!selectedLease || !providerInfo) return;

    getLeaseStatus();
  }, [selectedLease, providerInfo, getLeaseStatus]);

  useEffect(() => {
    if (!canSetConnection || !providerInfo || !isLocalCertMatching || !selectedLease || isConnectionEstablished) return;

    logs.current = [];

    let url: string | null = null;
    if (selectedLogsMode === "logs") {
      url = `${providerInfo.hostUri}/lease/${selectedLease.dseq}/${selectedLease.gseq}/${selectedLease.oseq}/logs?follow=true&tail=100`;

      if (selectedServices.length < services.length) {
        url += "&service=" + selectedServices.join(",");
      }
    } else {
      url = `${providerInfo.hostUri}/lease/${selectedLease.dseq}/${selectedLease.gseq}/${selectedLease.oseq}/kubeevents?follow=true`;
    }

    setIsLoadingLogs(true);

    sendJsonMessage({
      type: "websocket",
      url: url,
      certPem: localCert?.certPem,
      keyPem: localCert?.keyPem
    });
  }, [
    isLocalCertMatching,
    selectedLogsMode,
    selectedLease,
    selectedServices,
    localCert?.certPem,
    localCert?.keyPem,
    services?.length,
    updateLogText,
    canSetConnection,
    isConnectionEstablished,
    providerInfo
  ]);

  function onLogReceived(event) {
    const message = JSON.parse(event.data).message;

    setIsLoadingLogs(true);

    if (logs.current.length === 0) {
      setStickToBottom(true);
    }

    // TODO Type
    let parsedLog: any = null;
    try {
      parsedLog = JSON.parse(message);
      if (selectedLogsMode === "logs") {
        parsedLog.service = parsedLog?.name ? parsedLog?.name.split("-")[0] : "";
        parsedLog.message = `[${parsedLog.service}]: ${parsedLog.message}`;
        // parsedLog.message = `[${format(new Date(), "yyyy-MM-dd|HH:mm:ss.SSS")}] ${parsedLog.service}: ${parsedLog.message}`;
      } else {
        parsedLog.service = parsedLog.object?.name ? parsedLog.object?.name.split("-")[0] : "";
        parsedLog.message = `[${parsedLog.service}]: [${parsedLog.type}] [${parsedLog.reason}] [${parsedLog.object?.kind}] ${parsedLog.note}`;
      }

      logs.current = logs.current.concat([parsedLog]);

      updateLogText();
    } catch (error) {
      console.log(error);
    }

    setIsConnectionEstablished(true);
  }

  useEffect(() => {
    if (stickToBottom && monacoEditorRef.current && monacoRef.current) {
      const editor = monacoEditorRef.current;
      const monaco = monacoRef.current;
      // Immediate scroll type, scroll to bottom
      editor.revealLine(editor.getModel()?.getLineCount() || 0, 1);
      // Clear selection
      editor.setSelection(new monaco.Selection(0, 0, 0, 0));
    }
  }, [logText, stickToBottom]);

  function handleLeaseChange(id) {
    setSelectedLease(leases?.find(x => x.id === id) || null);

    if (id !== selectedLease?.id) {
      setLogText("");
      setServices([]);
      setSelectedServices([]);
      setIsLoadingLogs(true);
      setCanSetConnection(false);
      setIsConnectionEstablished(false);
    }
  }

  const onSelectedServicesChange = selected => {
    setSelectedServices(selected);

    setLogText("");
    setIsLoadingLogs(true);
    setIsConnectionEstablished(false);
  };

  const onDownloadLogsClick = async () => {
    if (!isDownloadingLogs && providerInfo && selectedLease) {
      setIsDownloadingLogs(true);
      const isLogs = selectedLogsMode === "logs";
      await downloadLogs(providerInfo.hostUri, selectedLease.dseq, selectedLease.gseq, selectedLease.oseq, isLogs);

      event(AnalyticsEvents.DOWNLOADED_LOGS, {
        category: "deployments",
        label: isLogs ? "Downloaded deployment logs" : "Downloaded deployment events"
      });

      setIsDownloadingLogs(false);
    }
  };

  return (
    <div>
      {isLocalCertMatching ? (
        <>
          {selectedLease && (
            <>
              <div className="flex h-[56px] items-center space-x-4 p-2">
                <div className="flex items-center">
                  {(leases?.length || 0) > 1 && <LeaseSelect leases={leases} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                  {services?.length > 0 && canSetConnection && (
                    <div className={cn({ ["ml-2"]: (leases?.length || 0) > 1 })}>
                      <SelectCheckbox
                        options={services}
                        onSelectedChange={onSelectedServicesChange}
                        label="Services"
                        disabled={selectedLogsMode !== "logs"}
                        defaultValue={selectedServices}
                      />
                    </div>
                  )}
                </div>

                {smallScreen ? (
                  <div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="rounded-full">
                          <MoreHoriz className="text-xs" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <CustomDropdownLinkItem>
                          <div className="flex items-center space-x-2">
                            <Checkbox checked={stickToBottom} onCheckedChange={checked => setStickToBottom(checked as boolean)} id="stick-bottom" />
                            <label
                              htmlFor="stick-bottom"
                              className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Stick to bottom
                            </label>
                          </div>
                        </CustomDropdownLinkItem>
                        {localCert && (
                          <CustomDropdownLinkItem
                            onClick={onDownloadLogsClick}
                            icon={isDownloadingLogs ? <Spinner /> : <Download />}
                            disabled={isDownloadingLogs}
                          >
                            {selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                          </CustomDropdownLinkItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckboxWithLabel label="Stick to bottom" checked={stickToBottom} onCheckedChange={checked => setStickToBottom(checked as boolean)} />
                    {localCert && (
                      <div className="ml-4">
                        <Button
                          onClick={onDownloadLogsClick}
                          variant="default"
                          size="sm"
                          color="secondary"
                          disabled={isDownloadingLogs || !isConnectionEstablished}
                        >
                          {isDownloadingLogs ? <Spinner size="small" /> : selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isLoadingStatus && (
                  <div>
                    <Spinner size="small" />
                  </div>
                )}
              </div>

              <LinearLoadingSkeleton isLoading={isLoadingLogs} />

              <ViewPanel stickToBottom style={{ overflow: "hidden" }}>
                <MemoMonaco
                  value={logText}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: true
                  }}
                />
              </ViewPanel>
            </>
          )}
        </>
      ) : (
        <div className="p-4">
          <Alert variant="warning">You need a valid certificate to view deployment logs.</Alert>

          <Button variant="default" className="mt-4" disabled={isCreatingCert} onClick={() => createCertificate()}>
            {isCreatingCert ? <Spinner /> : "Create Certificate"}
          </Button>
        </div>
      )}
    </div>
  );
};
