import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCertificate } from "../../context/CertificateProvider";
import { LeaseSelect } from "./LeaseSelect";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import ViewPanel from "../shared/ViewPanel";
import { ServiceSelect } from "./ServiceSelect";
import { ShellDownloadModal } from "./ShellDownloadModal";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import { XTermRefType } from "@src/lib/XTerm/XTerm";
import { XTerm } from "@src/lib/XTerm";
import { LeaseShellCode } from "@src/types/shell";
import { useCustomWebSocket } from "@src/hooks/useCustomWebSocket";
import { LeaseDto } from "@src/types/deployment";
import { useProviderList } from "@src/queries/useProvidersQuery";

type Props = {
  leases: LeaseDto[];
};

export const DeploymentLeaseShell: React.FunctionComponent<Props> = ({ leases }) => {
  const [canSetConnection, setCanSetConnection] = useState(false);
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isConnectionClosed, setIsConnectionClosed] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedLease, setSelectedLease] = useState<LeaseDto>(null);
  const [isShowingDownloadModal, setIsShowingDownloadModal] = useState(false);
  const [isChangingSocket, setIsChangingSocket] = useState(false);
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, createCertificate, isCreatingCert } = useCertificate();
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus(providerInfo?.hostUri, selectedLease, {
    enabled: false
  });
  const currentUrl = useRef(null);
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
      certPem: localCert.certPem,
      keyPem: localCert.keyPem
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerInfo, isLocalCertMatching, selectedLease, selectedService, localCert.certPem, localCert.keyPem, isConnectionEstablished]);

  function onCommandResponseReceived(event: MessageEvent<any>) {
    const jsonData = JSON.parse(event.data);
    const message = jsonData?.message;
    const error = jsonData?.error;
    const closed = jsonData?.closed;

    if (message?.data) {
      let parsedData = Buffer.from(message.data).toString("utf-8", 1);

      let exitCode, errorMessage;
      try {
        const jsonData = JSON.parse(parsedData);
        exitCode = jsonData["exit_code"];
        errorMessage = jsonData["message"];
      } catch (error) {}
      if (exitCode === undefined) {
        if (!isConnectionEstablished) {
          // Welcome message
          terminalRef.current.reset();
          terminalRef.current.write("Welcome to Cloudmos Shell! ☁️");
          terminalRef.current.write("\n\r");
          terminalRef.current.write("You're now connected just as ssh to your docker instance.");
          terminalRef.current.write("\n\r");
          terminalRef.current.write("\n\r");
          terminalRef.current.focus();
        }

        terminalRef.current.write(parsedData);

        // Reset state
        setIsConnectionEstablished(true);
        setIsConnectionClosed(false);
        setIsChangingSocket(false);
        setIsLoadingData(false);
      }
    }

    if (error) {
      console.log(error);
      terminalRef.current.write(error);
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
    setSelectedLease(leases.find(x => x.id === id));

    if (id !== selectedLease.id) {
      // Clear terminal
      terminalRef.current.reset();

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
      terminalRef.current.reset();

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
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  padding: ".5rem",
                  height: "56px"
                }}
              >
                <Box display="flex" alignItems="center">
                  {leases?.length > 1 && <LeaseSelect leases={leases} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                  {services?.length > 0 && selectedService && (
                    <Box marginLeft={leases?.length > 1 ? ".5rem" : 0}>
                      <ServiceSelect services={services} defaultValue={selectedService} onSelectedChange={onSelectedServiceChange} />
                    </Box>
                  )}
                </Box>

                {localCert && (
                  <Box sx={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
                    <div>
                      <Button onClick={onDownloadFileClick} variant="contained" size="small" color="secondary" disabled={!isConnectionEstablished}>
                        Download file
                      </Button>
                    </div>
                  </Box>
                )}

                {(isLoadingStatus || isLoadingData) && (
                  <Box marginLeft="1rem">
                    <CircularProgress size="1rem" color="secondary" />
                  </Box>
                )}
              </Box>

              <ViewPanel stickToBottom style={{ overflow: "hidden" }}>
                {isConnectionClosed && (
                  <Alert variant="standard" severity="warning" sx={{ borderRadius: 0 }}>
                    The connection to your Cloudmos Shell was lost.
                  </Alert>
                )}
                <XTerm ref={terminalRef} onKey={onTerminalKey} onTerminalPaste={onTerminalPaste} />
              </ViewPanel>
            </>
          )}
        </>
      ) : (
        <Box sx={{ padding: "1rem" }}>
          <Alert severity="warning">You need a valid certificate to access the lease shell.</Alert>

          <Button variant="contained" color="secondary" size="medium" sx={{ marginTop: "1rem" }} disabled={isCreatingCert} onClick={() => createCertificate()}>
            {isCreatingCert ? <CircularProgress size="1.5rem" color="secondary" /> : "Create Certificate"}
          </Button>
        </Box>
      )}
    </div>
  );
};
