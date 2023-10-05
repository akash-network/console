import { ReactNode, useState } from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import WarningIcon from "@mui/icons-material/Warning";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { LeaseChip } from "./LeaseChip";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import { SpecDetailList } from "../shared/SpecDetailList";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { getAvgCostPerMonth, getTimeLeft, useRealTimeLeft } from "@src/utils/priceUtils";
import { Box, Checkbox, CircularProgress, darken, IconButton, Menu, TableCell, Tooltip, Typography } from "@mui/material";
import { UrlService } from "@src/utils/urlUtils";
import { cx } from "@emotion/css";
import { CustomMenuItem } from "../shared/CustomMenuItem";
import { DeploymentDepositModal } from "../deploymentDetail/DeploymentDepositModal";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { NamedDeploymentDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { CustomTableRow } from "../shared/CustomTable";
import { PriceValue } from "../shared/PriceValue";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { PricePerMonth } from "../shared/PricePerMonth";
import PublishIcon from "@mui/icons-material/Publish";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";

const useStyles = makeStyles()(theme => ({
  root: {
    cursor: "pointer",
    transition: "background-color .2s ease",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? darken(theme.palette.grey[800], 0.7) : theme.palette.grey[300]
    },
    [theme.breakpoints.down("md")]: {
      padding: ".5rem"
    }
  },
  deploymentInfo: {
    display: "flex",
    alignItems: "center",
    marginBottom: "2px",
    fontSize: ".875rem",
    lineHeight: "1rem"
  },
  title: {
    fontSize: "2rem",
    fontWeight: "bold"
  },
  dseq: {
    display: "inline",
    fontSize: "12px"
  },
  leaseChip: {
    marginLeft: ".5rem"
  },
  warningIcon: {
    fontSize: "1rem",
    marginLeft: ".5rem",
    color: theme.palette.error.main
  },
  editButton: {
    marginLeft: ".5rem",
    color: theme.palette.grey[400],
    transition: "color .3s ease",
    "&:hover": {
      color: theme.palette.text.primary
    }
  },
  editIcon: {
    fontSize: ".9rem"
  },
  tooltip: {
    fontSize: "1rem"
  },
  tooltipIcon: {
    fontSize: "1rem"
  }
}));

type Props = {
  deployment: NamedDeploymentDto;
  isSelectable?: boolean;
  onSelectDeployment?: (isChecked: boolean, dseq: string) => void;
  checked?: boolean;
  providers: Array<ApiProviderList>;
  refreshDeployments: any;
  children?: ReactNode;
};

export const DeploymentListRow: React.FunctionComponent<Props> = ({ deployment, isSelectable, onSelectDeployment, checked, providers, refreshDeployments }) => {
  const { classes } = useStyles();
  const router = useRouter();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { changeDeploymentName, getDeploymentData } = useLocalNotes();
  const { address, signAndBroadcastTx } = useKeplr();
  const isActive = deployment.state === "active";
  const { data: leases, isLoading: isLoadingLeases } = useAllLeases(address, { enabled: !!deployment && isActive });
  const filteredLeases = leases?.filter(l => l.dseq === deployment.dseq);
  const hasLeases = leases && !!leases.length && leases.some(l => l.dseq === deployment.dseq && l.state === "active");
  const hasActiveLeases = hasLeases && filteredLeases.some(l => l.state === "active");
  const deploymentCost = hasLeases ? filteredLeases.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const timeLeft = getTimeLeft(deploymentCost, deployment.escrowBalance);
  const realTimeLeft = useRealTimeLeft(deploymentCost, deployment.escrowBalance, parseFloat(deployment.escrowAccount.settled_at), deployment.createdAt);
  const deploymentName = deployment.name ? (
    <>
      <Typography variant="body2" className="text-truncate" title={deployment.name}>
        <strong>{deployment.name}</strong>
        <span className={classes.dseq}>&nbsp;-&nbsp;{deployment.dseq}</span>
      </Typography>
    </>
  ) : (
    <span className={classes.dseq}>{deployment.dseq}</span>
  );
  const showWarning = differenceInCalendarDays(timeLeft, new Date()) < 7;
  const escrowBalance = isActive && hasActiveLeases ? realTimeLeft?.escrow : deployment.escrowBalance;
  const amountSpent = isActive && hasActiveLeases ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount);
  const isValidTimeLeft = isActive && hasActiveLeases && isValid(realTimeLeft?.timeLeft);
  const avgCost = udenomToDenom(getAvgCostPerMonth(deploymentCost));
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const denomData = useDenomData(deployment.escrowAccount.balance.denom);

  function viewDeployment() {
    router.push(UrlService.deploymentDetails(deployment.dseq));
  }

  function handleMenuClick(ev) {
    ev.stopPropagation();
    setAnchorEl(ev.currentTarget);
  }

  const handleMenuClose = (event?) => {
    event?.stopPropagation();
    setAnchorEl(null);
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
        onSelectDeployment(false, deployment.dseq);

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

  return (
    <>
      <CustomTableRow className={classes.root} onClick={() => viewDeployment()}>
        <TableCell align="center">
          <SpecDetailList
            cpuAmount={deployment.cpuAmount}
            gpuAmount={deployment.gpuAmount}
            memoryAmount={deployment.memoryAmount}
            storageAmount={deployment.storageAmount}
            isActive={isActive}
          />
        </TableCell>
        <TableCell sx={{ maxWidth: "100px" }} align="center">
          {deploymentName}
        </TableCell>
        <TableCell align="center">
          {isActive && isValidTimeLeft && (
            <Box component="span" display="flex" alignItems="center">
              ~{formatDistanceToNow(realTimeLeft?.timeLeft)}
              {showWarning && <WarningIcon fontSize="small" color="error" className={classes.warningIcon} />}
            </Box>
          )}
        </TableCell>
        <TableCell align="center">
          {isActive && !!escrowBalance && (
            <Box marginLeft={isValidTimeLeft ? "1rem" : 0} display="flex">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases ? realTimeLeft?.escrow : escrowBalance, 6)}
              />
              <CustomTooltip
                arrow
                title={
                  <>
                    <strong>
                      {udenomToDenom(isActive && hasActiveLeases ? realTimeLeft?.escrow : escrowBalance, 6)}&nbsp;{denomData?.label}
                    </strong>
                    <Box display="flex">
                      {udenomToDenom(amountSpent, 2)} {denomData?.label} spent
                    </Box>
                    <br />
                    The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                  </>
                }
              >
                <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
              </CustomTooltip>

              {escrowBalance <= 0 && (
                <Tooltip
                  classes={{ tooltip: classes.tooltip }}
                  arrow
                  title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active."
                >
                  <WarningIcon color="error" className={cx(classes.tooltipIcon, classes.warningIcon)} />
                </Tooltip>
              )}
            </Box>
          )}
        </TableCell>
        <TableCell align="center">
          {isActive && !!deploymentCost && (
            <Box marginLeft="1rem" display="flex">
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <PricePerMonth denom={deployment.escrowAccount.balance.denom} perBlockValue={udenomToDenom(deploymentCost, 10)} typoVariant="body1" />

                <CustomTooltip
                  arrow
                  title={
                    <span>
                      {avgCost} {denomData?.label} / month
                    </span>
                  }
                >
                  <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
                </CustomTooltip>
              </Box>
            </Box>
          )}
        </TableCell>

        <TableCell align="center">
          {hasLeases && (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
              {filteredLeases?.map(lease => <LeaseChip key={lease.id} lease={lease} providers={providers} />)}
            </Box>
          )}
          {isLoadingLeases && <CircularProgress size="1rem" color="secondary" />}
        </TableCell>

        <TableCell align="center">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "end" }}>
            {isSelectable && (
              <Checkbox
                checked={checked}
                size="small"
                color="secondary"
                onClick={event => {
                  event.stopPropagation();
                }}
                onChange={event => {
                  onSelectDeployment(event.target.checked, deployment.dseq);
                }}
              />
            )}

            <Box marginLeft=".2rem">
              <IconButton onClick={handleMenuClick} size="small">
                <MoreHorizIcon />
              </IconButton>
            </Box>

            <Box marginLeft=".5rem" display="flex">
              <ChevronRightIcon />
            </Box>
          </Box>
        </TableCell>
      </CustomTableRow>

      <Menu
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
        {isActive && <CustomMenuItem onClick={() => setIsDepositingDeployment(true)} icon={<AddIcon fontSize="small" />} text="Add funds" />}
        <CustomMenuItem onClick={() => changeDeploymentName(deployment.dseq)} icon={<EditIcon fontSize="small" />} text="Edit name" />
        {storageDeploymentData?.manifest && <CustomMenuItem onClick={() => redeploy()} icon={<PublishIcon fontSize="small" />} text="Redeploy" />}
        {isActive && <CustomMenuItem onClick={() => onCloseDeployment()} icon={<CancelPresentationIcon fontSize="small" />} text="Close" />}
      </Menu>

      {isActive && isDepositingDeployment && (
        <DeploymentDepositModal
          denom={deployment.escrowAccount.balance.denom}
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}
    </>
  );
};
