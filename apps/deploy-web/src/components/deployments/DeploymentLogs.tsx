"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, CheckboxWithLabel, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { Monaco } from "@monaco-editor/react";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Download, MoreHoriz } from "iconoir-react";
import { isEqual } from "lodash";
import type { editor } from "monaco-editor";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { Editor } from "@src/components/shared/Editor/Editor";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { SelectCheckbox } from "@src/components/shared/SelectCheckbox";
import { ViewPanel } from "@src/components/shared/ViewPanel";
import { useServices } from "@src/context/ServicesProvider";
import type { LOGS_MODE } from "@src/hooks/useLogStream/useLogStream";
import { useLogStream } from "@src/hooks/useLogStream/useLogStream";
import { useProviderAccess } from "@src/hooks/useProviderAccess/useProviderAccess";
import { useProviderApiActions } from "@src/hooks/useProviderApiActions";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { LeaseDto } from "@src/types/deployment";
import { LeaseSelect } from "./LeaseSelect";
import { LogStreamPlaceholder } from "./LogStreamPlaceholder";
import { ProviderAuthFallback } from "./ProviderAuthGate";

type Props = {
  leases: Array<LeaseDto> | null | undefined;
  selectedLogsMode: LOGS_MODE;
};

export const DeploymentLogs: React.FunctionComponent<Props> = ({ leases, selectedLogsMode }) => {
  const { analyticsService } = useServices();
  const [isDownloadingLogs, setIsDownloadingLogs] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [selectedLease, setSelectedLease] = useState<LeaseDto | null>(null);
  const { data: providers } = useProviderList();
  const providerCredentials = useProviderCredentials();
  const hasLogsAccess = useProviderAccess(providerCredentials);
  const { downloadLogs } = useProviderApiActions();
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const providerInfo = providers?.find(p => p.owner === selectedLease?.provider);
  const providerHostUri = providerInfo?.hostUri;
  const providerAddress = providerInfo?.owner;
  const dseq = selectedLease?.dseq;
  const gseq = selectedLease?.gseq;
  const oseq = selectedLease?.oseq;
  const {
    data: leaseStatus,
    refetch: getLeaseStatus,
    isFetching: isLoadingStatus
  } = useLeaseStatus({
    provider: providerInfo,
    lease: selectedLease
  });
  const services = useMemo(() => (leaseStatus ? Object.keys(leaseStatus.services) : []), [leaseStatus]);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  const { logText, status, reconnect } = useLogStream({
    mode: selectedLogsMode,
    enabled: hasLogsAccess,
    providerBaseUrl: providerHostUri,
    providerAddress,
    ensureToken: providerCredentials.ensureToken,
    dseq,
    gseq,
    oseq,
    services,
    selectedServices
  });
  const emptyStreamStatus = !logText && (status === "silent" || status === "closed") ? status : null;
  const isResolvingStream = status === "idle" && (isLoadingStatus || services.length === 0);

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
    const next = leaseStatus ? Object.keys(leaseStatus.services) : [];
    setSelectedServices(prev => (isEqual(prev, next) ? prev : next));
  }, [leaseStatus]);

  useEffect(() => {
    if (!leases || leases.length === 0) return;

    setSelectedLease(leases[0]);
  }, [leases]);

  useEffect(() => {
    if (!selectedLease || !providerInfo) return;

    getLeaseStatus();
  }, [selectedLease, providerInfo, getLeaseStatus]);

  useEffect(
    function followNewOutput() {
      if (status === "streaming") setStickToBottom(true);
    },
    [status]
  );

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

  function handleLeaseChange(id: string) {
    setSelectedLease(leases?.find(x => x.id === id) || null);

    if (id !== selectedLease?.id) {
      setSelectedServices([]);
    }
  }

  const onDownloadLogsClick = async () => {
    if (!isDownloadingLogs && providerInfo && selectedLease) {
      setIsDownloadingLogs(true);
      const isLogs = selectedLogsMode === "logs";
      await downloadLogs(providerInfo, selectedLease.dseq, selectedLease.gseq, selectedLease.oseq, isLogs);

      analyticsService.track("downloaded_logs", {
        category: "deployments",
        label: isLogs ? "Downloaded deployment logs" : "Downloaded deployment events"
      });

      setIsDownloadingLogs(false);
    }
  };

  return (
    <div>
      <ProviderAuthFallback hasAccess={hasLogsAccess} error={providerCredentials.details.error} />

      {hasLogsAccess && (
        <>
          {selectedLease && (
            <>
              <div className="flex min-h-[50px] items-center gap-4">
                <div className="flex items-center">
                  {(leases?.length || 0) > 1 && <LeaseSelect leases={leases || []} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange} />}

                  {services?.length > 0 && (
                    <div className={cn({ ["ml-2"]: (leases?.length || 0) > 1 })}>
                      <SelectCheckbox
                        options={services}
                        selected={selectedServices}
                        onSelectedChange={setSelectedServices}
                        label="Services"
                        placeholder="Select services"
                        disabled={selectedLogsMode !== "logs"}
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
                        <CustomDropdownLinkItem
                          onClick={onDownloadLogsClick}
                          icon={isDownloadingLogs ? <Spinner /> : <Download />}
                          disabled={isDownloadingLogs}
                        >
                          {selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                        </CustomDropdownLinkItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckboxWithLabel label="Stick to bottom" checked={stickToBottom} onCheckedChange={checked => setStickToBottom(checked as boolean)} />
                    <div className="ml-4">
                      <Button onClick={onDownloadLogsClick} variant="default" size="sm" color="secondary" disabled={isDownloadingLogs || !logText}>
                        {isDownloadingLogs ? <Spinner size="small" /> : selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                      </Button>
                    </div>
                  </div>
                )}

                {isLoadingStatus && (
                  <div>
                    <Spinner size="small" />
                  </div>
                )}
              </div>

              <LinearLoadingSkeleton isLoading={status === "connecting" || isResolvingStream} />

              <ViewPanel stickToBottom className="relative" style={{ overflow: "hidden" }}>
                <Editor
                  value={logText}
                  language={selectedLogsMode === "logs" ? "log" : "k8s-events"}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: true
                  }}
                />

                {emptyStreamStatus && <LogStreamPlaceholder mode={selectedLogsMode} status={emptyStreamStatus} onRetry={reconnect} />}
              </ViewPanel>
            </>
          )}
        </>
      )}
    </div>
  );
};
