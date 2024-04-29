"use client";
import { ReactNode, useState } from "react";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { LeaseChip } from "./LeaseChip";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import { SpecDetailList } from "../shared/SpecDetailList";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useRouter } from "next/navigation";
import { getAvgCostPerMonth, getTimeLeft, useRealTimeLeft } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentDepositModal } from "./DeploymentDepositModal";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { NamedDeploymentDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { PriceValue } from "../shared/PriceValue";
import { CustomTooltip } from "../shared/CustomTooltip";
import { PricePerMonth } from "../shared/PricePerMonth";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { TableCell, TableRow } from "../ui/table";
import { WarningCircle, MoreHoriz, InfoCircle, NavArrowRight, Plus, Edit, XmarkSquare, Upload } from "iconoir-react";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";
import Spinner from "../shared/Spinner";
import ClickAwayListener from "@mui/material/ClickAwayListener";

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
  const { address, signAndBroadcastTx } = useWallet();
  const isActive = deployment.state === "active";
  const { data: leases, isLoading: isLoadingLeases } = useAllLeases(address, { enabled: !!deployment && isActive });
  const filteredLeases = leases?.filter(l => l.dseq === deployment.dseq);
  const hasLeases = leases && !!leases.length && leases.some(l => l.dseq === deployment.dseq && l.state === "active");
  const hasActiveLeases = hasLeases && filteredLeases?.some(l => l.state === "active");
  const deploymentCost = hasLeases ? filteredLeases?.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const timeLeft = getTimeLeft(deploymentCost || 0, deployment.escrowBalance);
  const realTimeLeft = useRealTimeLeft(deploymentCost || 0, deployment.escrowBalance, parseFloat(deployment.escrowAccount.settled_at), deployment.createdAt);
  const deploymentName = deployment.name ? (
    <>
      <span className="truncate" title={deployment.name}>
        <strong>{deployment.name}</strong>
        <span className="inline text-sm">&nbsp;-&nbsp;{deployment.dseq}</span>
      </span>
    </>
  ) : (
    <span className="inline text-sm">{deployment.dseq}</span>
  );
  const showTimeLeftWarning = differenceInCalendarDays(timeLeft, new Date()) < 7;
  const escrowBalance = isActive && hasActiveLeases ? realTimeLeft?.escrow : deployment.escrowBalance;
  const amountSpent = isActive && hasActiveLeases ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount);
  const isValidTimeLeft = isActive && hasActiveLeases && isValid(realTimeLeft?.timeLeft);
  const avgCost = udenomToDenom(getAvgCostPerMonth(deploymentCost || 0));
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const denomData = useDenomData(deployment.escrowAccount.balance.denom);

  function viewDeployment() {
    router.push(UrlService.deploymentDetails(deployment.dseq));
  }

  function handleMenuClick(ev) {
    ev.stopPropagation();
    setOpen(true);
  }

  const handleMenuClose = (event?) => {
    event?.stopPropagation();
    setOpen(false);
  };

  const onDeploymentDeposit = async (deposit, depositorAddress) => {
    setIsDepositingDeployment(false);

    try {
      const message = TransactionMessageData.getDepositDeploymentMsg(
        address,
        deployment.dseq,
        deposit,
        deployment.escrowAccount.balance.denom,
        depositorAddress
      );
      const response = await signAndBroadcastTx([message]);
      if (response) {
        refreshDeployments();

        event(AnalyticsEvents.DEPLOYMENT_DEPOSIT, {
          category: "deployments",
          label: "Deposit to deployment from list"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const onCloseDeployment = async () => {
    handleMenuClose();

    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        if (onSelectDeployment) {
          onSelectDeployment(false, deployment.dseq);
        }

        refreshDeployments();

        event(AnalyticsEvents.CLOSE_DEPLOYMENT, {
          category: "deployments",
          label: "Close deployment from list"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const redeploy = () => {
    const url = UrlService.newDeployment({ redeploy: deployment.dseq });
    router.push(url);
  };

  function onDepositClicked(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setIsDepositingDeployment(true);
  }

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted-foreground/10 [&>td]:p-2" onClick={() => viewDeployment()}>
        <TableCell className="text-center">
          <SpecDetailList
            cpuAmount={deployment.cpuAmount}
            gpuAmount={deployment.gpuAmount}
            memoryAmount={deployment.memoryAmount}
            storageAmount={deployment.storageAmount}
            isActive={isActive}
          />
        </TableCell>
        <TableCell className="max-w-[100px] text-center">{deploymentName}</TableCell>
        <TableCell className="text-center">
          {isActive && isValidTimeLeft && realTimeLeft && (
            <span>
              ~{formatDistanceToNow(realTimeLeft?.timeLeft)}
              {showTimeLeftWarning && (
                <CustomTooltip
                  title={
                    <>
                      Your deployment will close soon,{" "}
                      <a href="#" onClick={onDepositClicked}>
                        Add Funds
                      </a>{" "}
                      to keep it running.
                    </>
                  }
                >
                  <WarningCircle className="ml-2 text-xs text-destructive-foreground" />
                </CustomTooltip>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {isActive && !!escrowBalance && (
            <div className="inline-flex">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : escrowBalance, 6)}
              />
              <CustomTooltip
                title={
                  <div className="text-left">
                    <div className="space-x-2">
                      <span>Balance:</span>
                      <strong>
                        {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : escrowBalance, 6)}&nbsp;{denomData?.label}
                      </strong>
                    </div>
                    <div className="space-x-2">
                      <span>Spent:</span>
                      <strong>
                        {udenomToDenom(amountSpent || 0, 2)} {denomData?.label}
                      </strong>
                    </div>
                    <br />
                    <p className="text-xs text-muted-foreground">
                      The escrow account balance will be fully returned to your wallet balance when the deployment is closed.
                    </p>
                  </div>
                }
              >
                <InfoCircle className="ml-2 text-xs text-muted-foreground" />
              </CustomTooltip>

              {escrowBalance <= 0 && (
                <CustomTooltip title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active.">
                  <WarningCircle className="ml-2 text-destructive-foreground" />
                </CustomTooltip>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          {isActive && !!deploymentCost && (
            <div className="ml-4 inline-flex">
              <div className="flex items-center">
                <PricePerMonth denom={deployment.escrowAccount.balance.denom} perBlockValue={udenomToDenom(deploymentCost, 10)} className="whitespace-nowrap" />

                <CustomTooltip
                  title={
                    <span>
                      {avgCost} {denomData?.label} / month
                    </span>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>
            </div>
          )}
        </TableCell>

        <TableCell className="text-center">
          {hasLeases && (
            <div className="inline-flex flex-wrap items-center">
              {filteredLeases?.map(lease => <LeaseChip key={lease.id} lease={lease} providers={providers} />)}
            </div>
          )}
          {isLoadingLeases && <Spinner size="small" />}
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
                        <CustomDropdownLinkItem onClick={onDepositClicked} icon={<Plus fontSize="small" />}>
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
