"use client";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  CustomTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Spinner,
  TableCell,
  TableRow
} from "@akashnetwork/ui/components";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import { CalendarArrowDown, Coins, Edit, MoreHoriz, NavArrowRight, Plus, Upload, WarningTriangle, XmarkSquare } from "iconoir-react";
import { keyBy } from "lodash";
import { useRouter } from "next/navigation";

import { useCertificate } from "@src/context/CertificateProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useRealTimeLeft } from "@src/hooks/useRealTimeLeft";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { useAllLeases, useLeaseStatus } from "@src/queries/useLeaseQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth, getTimeLeft } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { TrialDeploymentBadge } from "../shared";
import { CopyTextToClipboardButton } from "../shared/CopyTextToClipboardButton";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";
import { PricePerMonth } from "../shared/PricePerMonth";
import { PriceValue } from "../shared/PriceValue";
import { SpecDetailList } from "../shared/SpecDetailList";
import { DeploymentName } from "./DeploymentName/DeploymentName";
import type { DeploymentDepositModalProps } from "./DeploymentDepositModal";
import { DeploymentDepositModal } from "./DeploymentDepositModal";
import { LeaseChip } from "./LeaseChip";

type Props = {
  deployment: NamedDeploymentDto;
  isSelectable?: boolean;
  onSelectDeployment?: (isChecked: boolean, dseq: string) => void;
  checked?: boolean;
  providers: Array<ApiProviderList> | undefined;
  refreshDeployments: any;
  children?: ReactNode;
};

export const DeploymentListRow: React.FunctionComponent<Props> = ({ deployment, isSelectable, onSelectDeployment, checked, providers, refreshDeployments }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const { changeDeploymentName, getDeploymentData } = useLocalNotes();
  const { address, signAndBroadcastTx, isManaged: isManagedWallet, isTrialing } = useWallet();
  const isActive = deployment.state === "active";
  const { data: leases, isLoading: isLoadingLeases } = useAllLeases(address, { enabled: !!deployment && isActive });
  const filteredLeases = leases?.filter(l => l.dseq === deployment.dseq);
  const hasLeases = leases && !!leases.length && leases.some(l => l.dseq === deployment.dseq && l.state === "active");
  const hasActiveLeases = hasLeases && filteredLeases?.some(l => l.state === "active");
  const isAllLeasesClosed = hasLeases && !filteredLeases?.some(l => l.state === "active");
  const deploymentCost = hasLeases ? filteredLeases?.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const timeLeft = getTimeLeft(deploymentCost || 0, deployment.escrowBalance);
  const realTimeLeft = useRealTimeLeft(deploymentCost || 0, deployment.escrowBalance, parseFloat(deployment.escrowAccount.settled_at), deployment.createdAt);
  const showTimeLeftWarning = differenceInCalendarDays(timeLeft, new Date()) < 7;
  const escrowBalance = isActive && hasActiveLeases ? realTimeLeft?.escrow : deployment.escrowBalance;
  const isRunningOutOfFunds = escrowBalance && escrowBalance <= 0;
  const amountSpent = isActive && hasActiveLeases ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount);
  const isValidTimeLeft = isActive && hasActiveLeases && isValid(realTimeLeft?.timeLeft);
  const avgCost = udenomToDenom(getAvgCostPerMonth(deploymentCost || 0));
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const denomData = useDenomData(deployment.escrowAccount.balance.denom);
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const providersByOwner = useMemo(() => keyBy(providers, p => p.owner), [providers]);
  const lease = filteredLeases?.find(lease => !!(lease?.provider && providersByOwner[lease.provider]));
  const provider = providersByOwner[lease?.provider || ""];
  const { localCert } = useCertificate();
  const { data: leaseStatus } = useLeaseStatus({ provider, lease, enabled: !!(provider && lease && localCert) });
  const isAnonymousFreeTrialEnabled = useFlag("anonymous_free_trial");

  const viewDeployment = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as Element).closest(`a, button, [role="button"]`)) return;
      router.push(UrlService.deploymentDetails(deployment.dseq));
    },
    [router, deployment.dseq]
  );

  function handleMenuClick() {
    setOpen(true);
  }

  const handleMenuClose = () => {
    setOpen(false);
  };

  const onDeploymentDeposit: DeploymentDepositModalProps["onDeploymentDeposit"] = async (deposit, depositorAddress) => {
    setIsDepositingDeployment(false);

    const message = TransactionMessageData.getDepositDeploymentMsg(address, deployment.dseq, deposit, deployment.escrowAccount.balance.denom, depositorAddress);
    const response = await signAndBroadcastTx([message]);
    if (response) {
      refreshDeployments();

      analyticsService.track("deployment_deposit", {
        category: "deployments",
        label: "Deposit to deployment from list"
      });
    }
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
        onSelectDeployment(false, deployment.dseq);
      }

      refreshDeployments();

      analyticsService.track("close_deployment", {
        category: "deployments",
        label: "Close deployment from list"
      });
    }
  };

  const redeploy = () => {
    const url = UrlService.newDeployment({ redeploy: deployment.dseq });
    router.push(url);
  };

  function showDepositModal(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setIsDepositingDeployment(true);
  }

  const escrowBalanceInDenom = useMemo(() => {
    let uDenomBalance: number | undefined;

    if (isActive && hasActiveLeases && realTimeLeft) {
      uDenomBalance = realTimeLeft?.escrow;
    } else {
      uDenomBalance = escrowBalance;
    }
    return uDenomBalance && udenomToDenom(uDenomBalance, 6);
  }, [isActive, hasActiveLeases, realTimeLeft, escrowBalance]);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted-foreground/10 [&>td]:p-2" role="link" onClick={viewDeployment}>
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

          {!isAnonymousFreeTrialEnabled && isTrialing && (
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
              <CustomTooltip
                disabled={isManagedWallet}
                title={
                  <span>
                    {avgCost} {denomData?.label} / month
                  </span>
                }
              >
                <div className={`flex items-center ${isManagedWallet ? "" : "cursor-help"}`}>
                  <CalendarArrowDown className="mr-2 text-xs" />
                  <PricePerMonth
                    denom={deployment.escrowAccount.balance.denom}
                    perBlockValue={udenomToDenom(deploymentCost, 10)}
                    className="whitespace-nowrap"
                  />
                </div>
              </CustomTooltip>
            )}
            {isActive && !!escrowBalanceInDenom && !!escrowBalance && (
              <CustomTooltip
                title={
                  <div className="text-left">
                    <div className="space-x-2">
                      <span>Balance:</span>
                      <strong>
                        {isManagedWallet ? (
                          <PriceValue denom={deployment.escrowAccount.balance.denom} value={escrowBalanceInDenom} />
                        ) : (
                          `${escrowBalanceInDenom} ${denomData?.label}`
                        )}
                      </strong>
                    </div>
                    <div className="space-x-2">
                      <span>Spent:</span>
                      <strong>
                        {isManagedWallet ? (
                          <PriceValue denom={deployment.escrowAccount.balance.denom} value={udenomToDenom(amountSpent || 0, 2)} />
                        ) : (
                          `${udenomToDenom(amountSpent || 0, 2)} ${denomData?.label}`
                        )}
                      </strong>
                    </div>
                    <br />
                    <p className="text-xs text-muted-foreground">
                      The escrow account balance will be fully returned to your wallet balance when the deployment is closed.
                    </p>
                  </div>
                }
              >
                <div className="inline-flex cursor-help">
                  <Coins className="mr-2 text-xs" />
                  <PriceValue denom={deployment.escrowAccount.balance.denom} value={escrowBalanceInDenom} />
                </div>
              </CustomTooltip>
            )}
          </div>
          {isActive && ((isValidTimeLeft && realTimeLeft) || isRunningOutOfFunds) && (
            <CustomTooltip
              disabled={!(showTimeLeftWarning || isRunningOutOfFunds)}
              title={
                <>
                  Your deployment will close soon,{" "}
                  <a href="#" onClick={showDepositModal}>
                    Add Funds
                  </a>{" "}
                  to keep it running.
                </>
              }
            >
              <div className={`inline-flex items-center space-x-2 text-xs ${showTimeLeftWarning || isRunningOutOfFunds ? "cursor-help text-warning" : ""}`}>
                <span>
                  {isRunningOutOfFunds
                    ? `Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active.`
                    : getTimeLeftText(realTimeLeft?.timeLeft)}
                </span>
                {showTimeLeftWarning && <WarningTriangle className="text-xs" />}
              </div>
            </CustomTooltip>
          )}
        </TableCell>

        <TableCell className="text-center">
          {hasLeases && (
            <div className="inline-flex flex-wrap items-center">
              {filteredLeases?.map(lease => <LeaseChip key={lease.id} lease={lease} providers={providers} />)}
            </div>
          )}
          {isLoadingLeases && <Spinner size="small" />}
          {!isLoadingLeases && isAllLeasesClosed && <Badge>All leases closed</Badge>}
        </TableCell>

        <TableCell>
          <div className="flex items-center justify-end space-x-2">
            {isSelectable && (
              <Checkbox
                checked={checked}
                onClick={event => {
                  event.stopPropagation();
                }}
                onCheckedChange={value => {
                  onSelectDeployment && onSelectDeployment(value as boolean, deployment.dseq);
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
                      {isActive && (
                        <CustomDropdownLinkItem onClick={showDepositModal} icon={<Plus fontSize="small" />}>
                          Add funds
                        </CustomDropdownLinkItem>
                      )}
                      <CustomDropdownLinkItem onClick={() => changeDeploymentName(deployment.dseq)} icon={<Edit fontSize="small" />}>
                        Edit name
                      </CustomDropdownLinkItem>
                      {storageDeploymentData?.manifest && (
                        <CustomDropdownLinkItem onClick={() => redeploy()} icon={<Upload fontSize="small" />}>
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
              <NavArrowRight />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {isActive && isDepositingDeployment && (
        <DeploymentDepositModal
          denom={deployment.escrowAccount.balance.denom}
          disableMin
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}
    </>
  );
};

function getTimeLeftText(timeLeft?: Date) {
  if (!timeLeft) return "";
  const text = formatDistanceToNow(timeLeft);
  return `will be active for ${text.startsWith("about") ? text : `about ${text}`}`;
}
