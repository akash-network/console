"use client";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner, TableCell, TableRow } from "@akashnetwork/ui/components";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import { CalendarArrowDown, Edit, MoreHoriz, NavArrowRight, Upload, XmarkSquare } from "iconoir-react";
import { keyBy } from "lodash";
import { useRouter } from "next/navigation";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDeclaredGpuInterconnect } from "@src/hooks/useDeclaredGpuInterconnect";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import { useDeploymentLeaseList, useLeaseStatus } from "@src/queries/useLeaseQuery";
import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getClosedLeaseLabel, getReclamationDeadline, isReclaiming } from "@src/utils/reclamationUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { TrialDeploymentBadge } from "../shared";
import { CopyTextToClipboardButton } from "../shared/CopyTextToClipboardButton";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";
import { GpuInterconnectBadge } from "../shared/GpuInterconnectBadge";
import { PriceEstimateTooltip } from "../shared/PriceEstimateTooltip";
import { PricePerTimeUnit } from "../shared/PricePerTimeUnit";
import { SpecDetailList } from "../shared/SpecDetailList";
import { DeploymentName } from "./DeploymentName/DeploymentName";
import { LeaseChip } from "./LeaseChip";

type Props = {
  deployment: NamedDeploymentDto;
  isSelectable?: boolean;
  onSelectDeployment?: ({ id, isShiftPressed }: { id: string; isShiftPressed: boolean }) => void;
  checked?: boolean;
  providers: Array<ApiProviderList> | undefined;
  refreshDeployments: () => void;
  children?: ReactNode;
};

export const DeploymentListRow: React.FunctionComponent<Props> = ({ deployment, isSelectable, onSelectDeployment, checked, providers, refreshDeployments }) => {
  const router = useRouter();
  const { analyticsService } = useServices();
  const [open, setOpen] = useState(false);
  const { changeDeploymentName, getDeploymentData } = useLocalNotes();
  const { address, signAndBroadcastTx, isTrialing } = useWallet();
  const isActive = deployment.state === "active";
  const { data: filteredLeases, isLoading: isLoadingLeases } = useDeploymentLeaseList(address, deployment, { enabled: !!deployment });
  // A reclaiming lease is still running (grace period), so it counts as live for cost/escrow metrics.
  const liveLeases = filteredLeases?.filter(isLeaseLive);
  const hasActiveLeases = !!liveLeases?.length;
  const reclaimingLease = filteredLeases?.find(isReclaiming);
  const closedLease = filteredLeases?.find(l => !isLeaseLive(l));
  const isAllLeasesClosed = !!filteredLeases?.length && !hasActiveLeases;
  const deploymentCost = liveLeases?.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) ?? 0;
  const reclaimDeadline = reclaimingLease ? getReclamationDeadline(reclaimingLease) : null;
  const closedReasonLabel = closedLease ? getClosedLeaseLabel(closedLease) : null;
  const hasGpu = Boolean(deployment.gpuAmount && deployment.gpuAmount > 0);
  const interconnect = useDeclaredGpuInterconnect(deployment);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const providersByOwner = useMemo(() => keyBy(providers, p => p.owner), [providers]);
  const lease = filteredLeases?.find(lease => !!(lease?.provider && providersByOwner[lease.provider]));
  const provider = providersByOwner[lease?.provider || ""];
  const providerCredentials = useProviderCredentials();
  const { data: leaseStatus } = useLeaseStatus({ provider, lease, enabled: !!(provider && lease && isLeaseLive(lease) && providerCredentials.details.usable) });

  const viewDeployment = useCallback(() => {
    router.push(UrlService.deploymentDetails(deployment.dseq));
  }, [router, deployment.dseq]);

  function handleMenuClick() {
    setOpen(true);
  }

  const handleMenuClose = () => {
    setOpen(false);
  };

  const onCloseDeployment = async () => {
    handleMenuClose();

    const isConfirmed = await closeDeploymentConfirm([deployment.dseq]);

    if (!isConfirmed) {
      return;
    }

    const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
    const response = await signAndBroadcastTx([message]);
    if (response) {
      if (onSelectDeployment) {
        onSelectDeployment({ id: deployment.dseq, isShiftPressed: false });
      }

      refreshDeployments();

      analyticsService.track("close_deployment", {
        category: "deployments",
        label: "Close deployment from list"
      });
    }
  };

  const redeploy = useRedeploy();

  return (
    <>
      <TableRow className="hover:bg-muted-foreground/10 [&>td]:p-2">
        <TableCell>
          <div className="flex items-center justify-center">
            <SpecDetailList
              cpuAmount={deployment.cpuAmount}
              gpuAmount={deployment.gpuAmount}
              memoryAmount={deployment.memoryAmount}
              storageAmount={deployment.storageAmount}
              isActive={isActive}
            />
          </div>
        </TableCell>
        <TableCell className="max-w-[100px] text-center">
          <DeploymentName deployment={deployment} deploymentServices={leaseStatus?.services} providerHostUri={provider?.hostUri} />

          {interconnect.enabled && (
            <div className="mt-2 flex justify-center">
              <GpuInterconnectBadge interconnect={interconnect} compact />
            </div>
          )}

          {isTrialing && (
            <div className="mt-2">
              <TrialDeploymentBadge createdHeight={deployment.createdAt} />
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-x-1">
            <span>{deployment.dseq || "N/A"}</span>
            <CopyTextToClipboardButton value={deployment.dseq} />
          </div>
        </TableCell>
        <TableCell className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {isActive && !!deploymentCost && (
              <div className="flex items-center">
                <CalendarArrowDown className="mr-2 text-xs" />
                <PricePerTimeUnit
                  denom={getEscrowDenom(deployment)}
                  perBlockValue={udenomToDenom(deploymentCost, 10)}
                  className="whitespace-nowrap"
                  showAsHourly={hasGpu}
                />
                <PriceEstimateTooltip denom={getEscrowDenom(deployment)} value={deploymentCost} showAsHourly={hasGpu} />
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="text-center">
          {isLoadingLeases && <Spinner size="small" />}
          {!isLoadingLeases && (
            <div className="inline-flex flex-col items-center gap-1">
              {hasActiveLeases && (
                <div className="inline-flex flex-wrap items-center justify-center gap-1">
                  {liveLeases?.map(lease => <LeaseChip key={lease.id} lease={lease} providers={providers} />)}
                </div>
              )}
              {reclaimingLease && (
                <span className="whitespace-nowrap text-xs text-warning">
                  {reclaimDeadline ? `closes in ${formatDistanceToNowStrict(reclaimDeadline)}` : "reclamation pending"}
                </span>
              )}
              {isAllLeasesClosed && closedReasonLabel && <Badge variant="outline">{closedReasonLabel}</Badge>}
            </div>
          )}
        </TableCell>

        <TableCell>
          <div className="flex items-center justify-end">
            {isSelectable && (
              <Checkbox
                checked={checked}
                expandedTouchTarget={true}
                onClick={event => {
                  event.stopPropagation();
                  onSelectDeployment?.({ id: deployment.dseq, isShiftPressed: event.shiftKey });
                }}
              />
            )}

            <div className="">
              <DropdownMenu modal={false} open={open}>
                <DropdownMenuTrigger asChild>
                  <Button onClick={handleMenuClick} size="icon" variant="ghost" className="rounded-full">
                    <MoreHoriz />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onMouseLeave={() => setOpen(false)}
                  onClick={e => {
                    e.stopPropagation();
                  }}
                >
                  <ClickAwayListener onClickAway={() => setOpen(false)}>
                    <div>
                      <CustomDropdownLinkItem onClick={() => changeDeploymentName(deployment.dseq)} icon={<Edit fontSize="small" />}>
                        Edit name
                      </CustomDropdownLinkItem>
                      {storageDeploymentData?.manifest && (
                        <CustomDropdownLinkItem
                          onClick={() => redeploy({ sdl: storageDeploymentData?.manifest, name: storageDeploymentData?.name })}
                          icon={<Upload fontSize="small" />}
                        >
                          Redeploy
                        </CustomDropdownLinkItem>
                      )}
                      {isActive && (
                        <CustomDropdownLinkItem onClick={() => onCloseDeployment()} icon={<XmarkSquare fontSize="small" />}>
                          Close
                        </CustomDropdownLinkItem>
                      )}
                    </div>
                  </ClickAwayListener>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex pr-2">
              <Button onClick={viewDeployment} size="icon" variant="ghost" className="rounded-full">
                <NavArrowRight />
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
};
