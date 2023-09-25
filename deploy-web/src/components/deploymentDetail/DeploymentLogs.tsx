import { useCertificate } from "@src/context/CertificateProvider";
import { useThrottledCallback } from "@src/hooks/useThrottle";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { MemoMonaco } from "../shared/MemoMonaco";
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, IconButton, Menu, MenuItem, useMediaQuery, useTheme } from "@mui/material";
import { LeaseSelect } from "./LeaseSelect";
import { SelectCheckbox } from "../shared/SelectCheckbox";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import ViewPanel from "../shared/ViewPanel";
import useWebSocket from "react-use-websocket";
import { PROVIDER_PROXY_URL_WS } from "@src/utils/constants";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";
import { LeaseDto } from "@src/types/deployment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { CustomMenuItem } from "../shared/CustomMenuItem";
import DownloadIcon from "@mui/icons-material/Download";
import { useProviderList } from "@src/queries/useProvidersQuery";

const useStyles = makeStyles()(theme => ({
  root: {
    "& .MuiToggleButton-root": {
      color: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.primary.main,
      "&.Mui-selected": {
        fontWeight: "bold",
        color: theme.palette.mode === "dark" ? theme.palette.secondary.main : theme.palette.primary.contrastText,
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.secondary.main
      }
    }
  }
}));

export type LOGS_MODE = "logs" | "events";

type Props = {
  leases: Array<LeaseDto>;
  selectedLogsMode: LOGS_MODE;
};

export const DeploymentLogs: React.FunctionComponent<Props> = ({ leases, selectedLogsMode }) => {
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [canSetConnection, setCanSetConnection] = useState(false);
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const logs = useRef([]);
  const [logText, setLogText] = useState("");
  const [isDownloadingLogs, setIsDownloadingLogs] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [selectedLease, setSelectedLease] = useState(null);
  const { classes } = useStyles();
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, isCreatingCert, createCertificate } = useCertificate();
  const { downloadLogs } = useBackgroundTask();
  const monacoEditorRef = useRef(null);
  const monacoRef = useRef(null);
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus(providerInfo?.hostUri, selectedLease || {}, {
    enabled: false
  });
  const { sendJsonMessage } = useWebSocket(PROVIDER_PROXY_URL_WS, {
    onOpen: () => {
      // console.log("opened");
    },
    onMessage: onLogReceived,
    onError: error => console.error("error", error),
    shouldReconnect: closeEvent => {
      // console.log(closeEvent);
      return true;
    }
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  function handleEditorDidMount(editor, monaco) {
    // here is another way to get monaco instance
    // you can also store it in `useRef` for further usage
    monacoEditorRef.current = editor;
    monacoRef.current = monaco;
  }

  useEffect(() => {
    if (monacoEditorRef.current) {
      const editor = monacoEditorRef.current;

      editor.onDidScrollChange(event => {
        if (event.scrollTop < event._oldScrollTop) {
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

    let url = null;
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
      certPem: localCert.certPem,
      keyPem: localCert.keyPem
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

    let parsedLog = null;
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
      editor.revealLine(editor.getModel()?.getLineCount(), 1);
      // Clear selection
      editor.setSelection(new monaco.Selection(0, 0, 0, 0));
    }
  }, [logText, stickToBottom]);

  function handleLeaseChange(id) {
    setSelectedLease(leases.find(x => x.id === id));

    if (id !== selectedLease.id) {
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
    if (!isDownloadingLogs) {
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

  function handleMenuClick(ev) {
    setAnchorEl(ev.currentTarget);
  }

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <div className={classes.root}>
      {isLocalCertMatching ? (
        <>
          {selectedLease && (
            <>
              <Box display="flex" alignItems="center" padding=".5rem" height="56px">
                <Box display="flex" alignItems="center">
                  {leases?.length > 1 && <LeaseSelect leases={leases} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                  {services?.length > 0 && canSetConnection && (
                    <Box sx={{ marginLeft: leases?.length > 1 ? ".5rem" : 0 }}>
                      <SelectCheckbox
                        options={services}
                        onSelectedChange={onSelectedServicesChange}
                        label="Services"
                        disabled={selectedLogsMode !== "logs"}
                        defaultValue={selectedServices}
                      />
                    </Box>
                  )}
                </Box>

                {smallScreen ? (
                  <Box sx={{ marginLeft: "1rem" }}>
                    <IconButton aria-label="settings" aria-haspopup="true" onClick={handleMenuClick} size="small">
                      <MoreHorizIcon fontSize="medium" />
                    </IconButton>

                    <Menu
                      id="long-menu"
                      anchorEl={anchorEl}
                      keepMounted
                      open={Boolean(anchorEl)}
                      onClose={handleMenuClose}
                      anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right"
                      }}
                      transformOrigin={{
                        vertical: "top",
                        horizontal: "right"
                      }}
                    >
                      <MenuItem>
                        <FormControlLabel
                          control={<Checkbox color="secondary" checked={stickToBottom} onChange={ev => setStickToBottom(ev.target.checked)} size="small" />}
                          label={"Stick to bottom"}
                        />
                      </MenuItem>
                      {localCert && (
                        <CustomMenuItem
                          onClick={onDownloadLogsClick}
                          icon={isDownloadingLogs ? <CircularProgress size="1.2rem" color="secondary" /> : <DownloadIcon fontSize="small" />}
                          text={selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                          disabled={isDownloadingLogs}
                        />
                      )}
                    </Menu>
                  </Box>
                ) : (
                  <Box display="flex" alignItems="center" sx={{ marginLeft: "1rem", display: "flex", alignItems: "center" }}>
                    <FormControlLabel
                      control={<Checkbox color="secondary" checked={stickToBottom} onChange={ev => setStickToBottom(ev.target.checked)} size="small" />}
                      label={"Stick to bottom"}
                    />
                    {localCert && (
                      <Box marginRight="1rem">
                        <Button onClick={onDownloadLogsClick} variant="contained" size="small" color="secondary" disabled={isDownloadingLogs}>
                          {isDownloadingLogs ? (
                            <CircularProgress size="1.5rem" color="secondary" />
                          ) : selectedLogsMode === "logs" ? (
                            "Download logs"
                          ) : (
                            "Download events"
                          )}
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}

                {isLoadingStatus && (
                  <Box marginLeft="1rem">
                    <CircularProgress size="1rem" color="secondary" />
                  </Box>
                )}
              </Box>

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
        <Box sx={{ padding: "1rem" }}>
          <Alert severity="warning">You need a valid certificate to view deployment logs.</Alert>

          <Button variant="contained" color="secondary" size="medium" sx={{ marginTop: "1rem" }} disabled={isCreatingCert} onClick={() => createCertificate()}>
            {isCreatingCert ? <CircularProgress size="1.5rem" color="secondary" /> : "Create Certificate"}
          </Button>
        </Box>
      )}
    </div>
  );
};
