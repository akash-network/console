"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { OpenInWindow, WarningCircle } from "iconoir-react";
import Link from "next/link";

import ViewPanel from "@src/components/shared/ViewPanel";
import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { XTerm } from "@src/lib/XTerm";
import type { XTermRefType } from "@src/lib/XTerm/XTerm";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ReceivedShellMessage } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import { LeaseShellCode } from "@src/types/shell";
import { forEachGeneratedItem } from "@src/utils/array";
import { UrlService } from "@src/utils/urlUtils";
import { CreateCredentialsButton } from "./CreateCredentialsButton/CreateCredentialsButton";
import { LeaseSelect } from "./LeaseSelect";
import { ServiceSelect } from "./ServiceSelect";
import { ShellDownloadModal } from "./ShellDownloadModal";

type Props = {
  leases: LeaseDto[] | null | undefined;
};

const textDecoder = new TextDecoder("utf-8");

export const DeploymentLeaseShell: React.FunctionComponent<Props> = ({ leases }) => {
  const { providerProxy, errorHandler } = useServices();

  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isConnectionClosed, setIsConnectionClosed] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedLease, setSelectedLease] = useState<LeaseDto | null>(null);
  const [isShowingDownloadModal, setIsShowingDownloadModal] = useState(false);
  const [isChangingSocket, setIsChangingSocket] = useState(false);
  const [showArrowAndTabWarning, setShowArrowAndTabWarning] = useState(false);
  const { data: providers } = useProviderList();
  const providerCredentials = useProviderCredentials();
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus({
    provider: providerInfo,
    lease: selectedLease,
    enabled: false
  });
  const terminalRef = useRef<XTermRefType>(null);
  const isConnectionEstablishedRef = useRef(false);
  const services = useMemo(() => (leaseStatus ? Object.keys(leaseStatus.services) : []), [leaseStatus]);

  useEffect(() => {
    if (leaseStatus) {
      // Set the first service as default
      setSelectedService(Object.keys(leaseStatus.services)[0]);
    }
  }, [leaseStatus]);

  useEffect(() => {
    if (!leases || leases.length === 0) return;

    setSelectedLease(leases[0]);
  }, [leases]);

  useEffect(() => {
    if (!selectedLease || !providerInfo) return;

    getLeaseStatus();
  }, [selectedLease, providerInfo, getLeaseStatus]);

  const shellSession = useMemo(() => {
    if (!providerInfo || !providerCredentials.details.usable || !selectedLease || !selectedService) return null;

    const abortController = new AbortController();
    const conn = providerProxy.connectToShell({
      providerBaseUrl: providerInfo.hostUri,
      providerAddress: providerInfo.owner,
      providerCredentials: providerCredentials.details,
      dseq: selectedLease.dseq,
      gseq: selectedLease.gseq,
      oseq: selectedLease.oseq,
      service: selectedService,
      useStdIn: true,
      useTTY: true,
      signal: abortController.signal
    });

    return {
      conn,
      abortController
    };
  }, [providerInfo, providerCredentials.details, selectedLease, selectedService]);

  useEffect(() => {
    if (!shellSession) return;

    setIsLoadingData(true);
    shellSession.conn.send(new Uint8Array());
    forEachGeneratedItem(shellSession.conn.receive(), onCommandResponseReceived).catch(error => {
      errorHandler.reportError({
        error,
        tags: { category: "deployments", label: "DeploymentLeaseShell" }
      });
    });

    return () => shellSession.abortController.abort();
  }, [shellSession]);

  function onCommandResponseReceived(jsonData: ReceivedShellMessage) {
    const message = jsonData?.message;
    const error = jsonData?.error;
    const closed = jsonData?.closed;

    if (message?.data) {
      const parsedData = textDecoder.decode(Uint8Array.from(message.data.slice(1)));

      // Check if parsedData is either ^[[A, ^[[B, ^[[C or ^[[D
      const arrowKeyPattern = /\^\[\[[A-D]/;
      if (arrowKeyPattern.test(parsedData)) {
        setShowArrowAndTabWarning(true);
      }

      let exitCode;
      try {
        const jsonData = JSON.parse(parsedData);
        exitCode = jsonData["exit_code"];
      } catch (error) {
        /* empty */
      }
      if (exitCode === undefined) {
        if (!isConnectionEstablishedRef.current) {
          // Welcome message
          terminalRef.current?.reset();
          terminalRef.current?.write("Welcome to Akash Console Shell! ☁️");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.write("You're now connected just as ssh to your docker instance.");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.focus();
          isConnectionEstablishedRef.current = true;
        }

        terminalRef.current?.write(parsedData);

        // Reset state
        setIsConnectionEstablished(true);
        setIsConnectionClosed(false);
        setIsChangingSocket(false);
        setIsLoadingData(false);
      }
    }

    if (error) {
      terminalRef.current?.write(error);
      setIsLoadingData(false);
    }

    if (closed && !isChangingSocket) {
      setIsConnectionClosed(true);
      setIsLoadingData(false);
      setIsChangingSocket(false);
    }
  }

  const getEncodedData = (data: string) => {
    // Data needs to be sent as a byte array
    const encoder = new TextEncoder();
    const _data = encoder.encode(data);
    const content = new Uint8Array(_data.length + 1);
    const stdin = new Uint8Array([LeaseShellCode.LeaseShellCodeStdin]);

    // Set first byte as Stdin code
    content.set(stdin);
    // Set the rest of the bytes of the input
    content.set(_data, 1);

    return content;
  };

  const onTerminalKey = useCallback(
    (event: { key: string; domEvent: KeyboardEvent }) => {
      const data = getEncodedData(event.key);
      shellSession?.conn.send(data);
    },
    [shellSession]
  );

  const onTerminalPaste = useCallback(
    (value: string) => {
      const data = getEncodedData(value);
      shellSession?.conn.send(data);
    },
    [shellSession]
  );

  function handleLeaseChange(id: string) {
    setSelectedLease(leases?.find(x => x.id === id) || null);

    if (id !== selectedLease?.id) {
      // Clear terminal
      terminalRef.current?.reset();

      setIsChangingSocket(true);
      setSelectedService(null);
      setIsConnectionEstablished(false);
      isConnectionEstablishedRef.current = false;
    }
  }

  const onSelectedServiceChange = (value: string) => {
    setSelectedService(value);

    if (value !== selectedService) {
      // Clear terminal
      terminalRef.current?.reset();

      setIsChangingSocket(true);
      setIsConnectionEstablished(false);
      isConnectionEstablishedRef.current = false;
    }
  };

  const onDownloadFileClick = async () => {
    setIsShowingDownloadModal(true);
  };

  const onCloseDownloadClick = () => {
    // setIsDownloadingFile(false);
    setIsShowingDownloadModal(false);
  };

  return (
    <div>
      {isShowingDownloadModal && selectedLease && providerInfo && selectedService && (
        <ShellDownloadModal onCloseClick={onCloseDownloadClick} selectedLease={selectedLease} providerInfo={providerInfo} selectedService={selectedService} />
      )}

      {providerCredentials.details.usable ? (
        <>
          {selectedLease && (
            <>
              {!isConnectionClosed && (
                <>
                  <div className="flex h-[56px] items-center space-x-4 p-2">
                    <div className="flex items-center">
                      {(leases?.length || 0) > 1 && <LeaseSelect leases={leases || []} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                      {services?.length > 0 && selectedService && (
                        <div className={cn({ ["ml-2"]: (leases?.length || 0) > 1 })}>
                          <ServiceSelect services={services} defaultValue={selectedService} onSelectedChange={onSelectedServiceChange} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      <Button onClick={onDownloadFileClick} variant="default" size="sm" disabled={!isConnectionEstablished}>
                        Download file
                      </Button>
                    </div>

                    {(isLoadingStatus || isLoadingData) && (
                      <div>
                        <Spinner size="small" />
                      </div>
                    )}
                  </div>

                  {showArrowAndTabWarning && (
                    <Alert variant="warning" className="mb-1 rounded-none">
                      <Link href={UrlService.faq("shell-arrows-and-completion")} target="_blank" className="inline-flex items-center space-x-2">
                        <span>Why is my UP arrow and TAB autocompletion not working?</span>
                        <OpenInWindow className="text-xs" />
                      </Link>
                    </Alert>
                  )}
                </>
              )}

              <ViewPanel stickToBottom className="overflow-hidden">
                {isConnectionClosed ? (
                  <Alert variant="destructive" className="mt-6 bg-card">
                    <WarningCircle className="mt-2 h-5 w-5" />
                    <AlertTitle className="mb-4">Shell access unavailable</AlertTitle>
                    <AlertDescription className="text-primary">
                      <p>We recommend:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Reviewing your service logs to confirm the container is running normally</li>
                        <li>Checking your manifest to ensure shell access is enabled (e.g., exec is configured)</li>
                        <li>Waiting briefly if the deployment was just created</li>
                        <li>Redeploying if the container appears stuck or unresponsive</li>
                        <li>Verifying the provider is healthy</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <XTerm ref={terminalRef} onKey={onTerminalKey} onTerminalPaste={onTerminalPaste} />
                )}
              </ViewPanel>
            </>
          )}
        </>
      ) : (
        <CreateCredentialsButton containerClassName="py-4" />
      )}
    </div>
  );
};
