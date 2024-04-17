"use client";
import { ReactNode, useState } from "react";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { LeaseChip } from "./LeaseChip";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import { SpecDetailList } from "../../components/shared/SpecDetailList";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useRouter } from "next/navigation";
import { getAvgCostPerMonth, getTimeLeft, useRealTimeLeft } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentDepositModal } from "../../components/deploymentDetail/DeploymentDepositModal";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { NamedDeploymentDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { PriceValue } from "../../components/shared/PriceValue";
import { CustomTooltip } from "../../components/shared/CustomTooltip";
import { PricePerMonth } from "../../components/shared/PricePerMonth";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { TableCell, TableRow } from "../../components/ui/table";
import { WarningCircle, MoreHoriz, InfoCircle, NavArrowRight, Plus, Edit, XmarkSquare, Upload } from "iconoir-react";
import { CustomDropdownLinkItem } from "../../components/shared/CustomDropdownLinkItem";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import Spinner from "../../components/shared/Spinner";
import ClickAwayListener from "@mui/material/ClickAwayListener";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     cursor: "pointer",
//     transition: "background-color .2s ease",
//     "&:hover": {
//       backgroundColor: theme.palette.mode === "dark" ? darken(theme.palette.grey[800], 0.7) : theme.palette.grey[300]
//     },
//     [theme.breakpoints.down("md")]: {
//       padding: ".5rem"
//     }
//   },
//   deploymentInfo: {
//     display: "flex",
//     alignItems: "center",
//     marginBottom: "2px",
//     fontSize: ".875rem",
//     lineHeight: "1rem"
//   },
//   title: {
//     fontSize: "2rem",
//     fontWeight: "bold"
//   },
//   dseq: {
//     display: "inline",
//     fontSize: "12px"
//   },
//   leaseChip: {
//     marginLeft: ".5rem"
//   },
//   warningIcon: {
//     fontSize: "1rem",
//     marginLeft: ".5rem",
//     color: theme.palette.error.main
//   },
//   editButton: {
//     marginLeft: ".5rem",
//     color: theme.palette.grey[400],
//     transition: "color .3s ease",
//     "&:hover": {
//       color: theme.palette.text.primary
//     }
//   },
//   editIcon: {
//     fontSize: ".9rem"
//   },
//   tooltip: {
//     fontSize: "1rem"
//   },
//   tooltipIcon: {
//     fontSize: "1rem"
//   }
// }));

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

  function onDepositClicked(e?: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
    e?.preventDefault();
    e?.stopPropagation();
    setIsDepositingDeployment(true);
  }

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted-foreground/10" onClick={() => viewDeployment()}>
        <TableCell align="center">
          <SpecDetailList
            cpuAmount={deployment.cpuAmount}
            gpuAmount={deployment.gpuAmount}
            memoryAmount={deployment.memoryAmount}
            storageAmount={deployment.storageAmount}
            isActive={isActive}
          />
        </TableCell>
        <TableCell className="max-w-[100px]" align="center">
          {deploymentName}
        </TableCell>
        <TableCell align="center">
          {isActive && isValidTimeLeft && realTimeLeft && (
            <div className="flex items-center">
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
            </div>
          )}
        </TableCell>
        <TableCell align="center">
          {isActive && !!escrowBalance && (
            <div className="flex">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : escrowBalance, 6)}
              />
              <CustomTooltip
                title={
                  <>
                    <strong>
                      {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : escrowBalance, 6)}&nbsp;{denomData?.label}
                    </strong>
                    <div className="flex">
                      {udenomToDenom(amountSpent || 0, 2)} {denomData?.label} spent
                    </div>
                    <br />
                    The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                  </>
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
        <TableCell align="center">
          {isActive && !!deploymentCost && (
            <div className="ml-4 flex">
              <div className="flex items-center">
                <PricePerMonth denom={deployment.escrowAccount.balance.denom} perBlockValue={udenomToDenom(deploymentCost, 10)} />

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

        <TableCell align="center">
          {hasLeases && (
            <div className="flex flex-wrap items-center">{filteredLeases?.map(lease => <LeaseChip key={lease.id} lease={lease} providers={providers} />)}</div>
          )}
          {isLoadingLeases && <Spinner size="small" />}
        </TableCell>

        <TableCell align="center">
          <div className="flex items-center justify-end">
            {isSelectable && (
              <Checkbox
                checked={checked}
                // size="small"
                // color="secondary"
                onClick={event => {
                  event.stopPropagation();
                }}
                onCheckedChange={value => {
                  onSelectDeployment && onSelectDeployment(value as boolean, deployment.dseq);
                }}
              />
            )}

            <div className="ml-1">
              {/* <Button onClick={handleMenuClick} size="icon" variant="ghost">
                <MoreHoriz />
              </Button> */}

              <DropdownMenu modal={false} open={open}>
                <DropdownMenuTrigger asChild>
                  <Button onClick={handleMenuClick} size="icon" variant="ghost">
                    <MoreHoriz />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onMouseLeave={() => setOpen(false)}>
                  <ClickAwayListener onClickAway={() => setOpen(false)}>
                    <div>
                      {isActive && (
                        <CustomDropdownLinkItem onClick={() => onDepositClicked} icon={<Plus fontSize="small" />}>
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

            <div className="ml-2 flex">
              <NavArrowRight />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* <Menu
        id={`deployment-list-menu-${deployment.dseq}`}
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
        onClick={handleMenuClose}
      >
        {isActive && <CustomMenuItem onClick={onDepositClicked} icon={<AddIcon fontSize="small" />} text="Add funds" />}
        <CustomMenuItem onClick={() => changeDeploymentName(deployment.dseq)} icon={<EditIcon fontSize="small" />} text="Edit name" />
        {storageDeploymentData?.manifest && <CustomMenuItem onClick={() => redeploy()} icon={<PublishIcon fontSize="small" />} text="Redeploy" />}
        {isActive && <CustomMenuItem onClick={() => onCloseDeployment()} icon={<CancelPresentationIcon fontSize="small" />} text="Close" />}
      </Menu> */}

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
