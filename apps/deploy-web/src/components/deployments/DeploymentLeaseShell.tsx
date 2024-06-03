"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { OpenInWindow, OpenNewWindow } from "iconoir-react";
import Link from "next/link";

import Spinner from "@src/components/shared/Spinner";
import ViewPanel from "@src/components/shared/ViewPanel";
import { Alert } from "@src/components/ui/alert";
import { Button } from "@src/components/ui/button";
import { useCertificate } from "@src/context/CertificateProvider";
import { useCustomWebSocket } from "@src/hooks/useCustomWebSocket";
import { XTerm } from "@src/lib/XTerm";
import { XTermRefType } from "@src/lib/XTerm/XTerm";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { LeaseDto } from "@src/types/deployment";
import { LeaseShellCode } from "@src/types/shell";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import { LeaseSelect } from "./LeaseSelect";
import { ServiceSelect } from "./ServiceSelect";
import { ShellDownloadModal } from "./ShellDownloadModal";

type Props = {
  leases: LeaseDto[] | null | undefined;
};

export const DeploymentLeaseShell: React.FunctionComponent<Props> = ({ leases }) => {
  const [canSetConnection, setCanSetConnection] = useState(false);
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isConnectionClosed, setIsConnectionClosed] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedLease, setSelectedLease] = useState<LeaseDto | null>(null);
  const [isShowingDownloadModal, setIsShowingDownloadModal] = useState(false);
  const [isChangingSocket, setIsChangingSocket] = useState(false);
  const [showArrowAndTabWarning, setShowArrowAndTabWarning] = useState(false);
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, createCertificate, isCreatingCert } = useCertificate();
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus(providerInfo?.hostUri || "", selectedLease as LeaseDto, {
    enabled: false
  });
  const currentUrl = useRef<string | null>(null);
  const terminalRef = useRef<XTermRefType>(null);
  const { sendJsonMessage } = useCustomWebSocket(PROVIDER_PROXY_URL_WS, {
    onOpen: () => {
      console.log("opened");
    },
    onMessage: onCommandResponseReceived,
    onError: error => console.error("error", error),
    shouldReconnect: closeEvent => {
      console.log(closeEvent);
      return true;
    }
  });

  useEffect(() => {
    // Set the services and default selected service
    if (leaseStatus) {
      setServices(Object.keys(leaseStatus.services));
      // Set the first service as default
      setSelectedService(Object.keys(leaseStatus.services)[0]);

      setCanSetConnection(true);
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

  useEffect(() => {
    if (!canSetConnection || !providerInfo || !isLocalCertMatching || !selectedLease || !selectedService || isConnectionEstablished) return;

    const url = `${providerInfo.hostUri}/lease/${selectedLease.dseq}/${selectedLease.gseq}/${
      selectedLease.oseq
    }/shell?stdin=1&tty=1&podIndex=0&cmd0=${encodeURIComponent("/bin/sh")}&service=${selectedService}`;
    setIsLoadingData(true);

    currentUrl.current = url;

    sendJsonMessage({
      type: "websocket",
      url: url,
      certPem: localCert?.certPem,
      keyPem: localCert?.keyPem
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerInfo, isLocalCertMatching, selectedLease, selectedService, localCert?.certPem, localCert?.keyPem, isConnectionEstablished]);

  function onCommandResponseReceived(event: MessageEvent<any>) {
    const jsonData = JSON.parse(event.data);
    const message = jsonData?.message;
    const error = jsonData?.error;
    const closed = jsonData?.closed;

    if (message?.data) {
      const parsedData = Buffer.from(message.data).toString("utf-8", 1);

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
        if (!isConnectionEstablished) {
          // Welcome message
          terminalRef.current?.reset();
          terminalRef.current?.write("Welcome to Akash Console Shell! ☁️");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.write("You're now connected just as ssh to your docker instance.");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.write("\n\r");
          terminalRef.current?.focus();
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
      console.log(error);
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
      // console.log(event, event.key);

      const data = getEncodedData(event.key);

      sendJsonMessage({
        type: "websocket",
        url: currentUrl.current,
        data: data.toString()
      });
    },
    [currentUrl.current]
  );

  const onTerminalPaste = useCallback(
    (value: string) => {
      const data = getEncodedData(value);

      sendJsonMessage({
        type: "websocket",
        url: currentUrl.current,
        data: data.toString()
      });
    },
    [currentUrl.current]
  );

  function handleLeaseChange(id: string) {
    setSelectedLease(leases?.find(x => x.id === id) || null);

    if (id !== selectedLease?.id) {
      // Clear terminal
      terminalRef.current?.reset();

      setIsChangingSocket(true);
      setServices([]);
      setSelectedService(null);
      setCanSetConnection(false);
      setIsConnectionEstablished(false);
    }
  }

  const onSelectedServiceChange = value => {
    setSelectedService(value);

    if (value !== selectedService) {
      // Clear terminal
      terminalRef.current?.reset();

      setIsChangingSocket(true);
      setIsConnectionEstablished(false);
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
      {isShowingDownloadModal && (
        <ShellDownloadModal onCloseClick={onCloseDownloadClick} selectedLease={selectedLease} providerInfo={providerInfo} selectedService={selectedService} />
      )}

      {isLocalCertMatching ? (
        <>
          {selectedLease && (
            <>
              <div className="flex h-[56px] items-center space-x-4 p-2">
                <div className="flex items-center">
                  {(leases?.length || 0) > 1 && <LeaseSelect leases={leases} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                  {services?.length > 0 && selectedService && (
                    <div className={cn({ ["ml-2"]: (leases?.length || 0) > 1 })}>
                      <ServiceSelect services={services} defaultValue={selectedService} onSelectedChange={onSelectedServiceChange} />
                    </div>
                  )}
                </div>

                {localCert && (
                  <div className="flex items-center">
                    <Button onClick={onDownloadFileClick} variant="default" size="sm" disabled={!isConnectionEstablished}>
                      Download file
                    </Button>
                  </div>
                )}

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

              <ViewPanel stickToBottom className="overflow-hidden">
                {isConnectionClosed && (
                  <Alert variant="warning" className="rounded-none">
                    The connection to your Akash Console Shell was lost. (
                    <Link href={UrlService.faq("shell-lost")} target="_blank" className="inline-flex items-center space-x-2">
                      <span>More Info</span>
                      <OpenNewWindow className="text-xs" alignmentBaseline="middle" />
                    </Link>
                    )
                  </Alert>
                )}
                <XTerm ref={terminalRef} onKey={onTerminalKey} onTerminalPaste={onTerminalPaste} />
              </ViewPanel>
            </>
          )}
        </>
      ) : (
        <div className="p-4">
          <Alert variant="warning">You need a valid certificate to access the lease shell.</Alert>

          <Button variant="default" className="mt-4" disabled={isCreatingCert} onClick={() => createCertificate()}>
            {isCreatingCert ? <Spinner size="small" /> : "Create Certificate"}
          </Button>
        </div>
      )}
    </div>
  );
};
