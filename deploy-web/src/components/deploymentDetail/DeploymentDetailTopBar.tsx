import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { DeploymentDepositModal } from "./DeploymentDepositModal";
import PublishIcon from "@mui/icons-material/Publish";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import EditIcon from "@mui/icons-material/Edit";
import { makeStyles } from "tss-react/mui";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { Box, Button, IconButton, Menu, Typography } from "@mui/material";
import { cx } from "@emotion/css";
import { CustomMenuItem } from "../shared/CustomMenuItem";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { DeploymentDto } from "@src/types/deployment";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";

const useStyles = makeStyles()(theme => ({
  title: {
    fontWeight: "bold",
    marginLeft: ".5rem",
    fontSize: "1.5rem"
  },
  actionContainer: {
    marginLeft: ".5rem",
    display: "flex",
    alignItems: "center",
    "& .MuiButtonBase-root:first-of-type": {
      marginLeft: 0
    }
  },
  actionButton: {
    marginLeft: ".5rem",
    whiteSpace: "nowrap"
  }
}));

type Props = {
  address: string;
  loadDeploymentDetail: () => void;
  removeLeases: () => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  deployment: DeploymentDto;
  children?: ReactNode;
};

export const DeploymentDetailTopBar: React.FunctionComponent<Props> = ({ address, loadDeploymentDetail, removeLeases, setActiveTab, deployment }) => {
  const { classes } = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const { changeDeploymentName, getDeploymentData, getDeploymentName } = useLocalNotes();
  const router = useRouter();
  const { signAndBroadcastTx } = useWallet();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const deploymentName = getDeploymentName(deployment?.dseq);
  const previousRoute = usePreviousRoute();

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.deploymentList());
    }
  }

  const onCloseDeployment = async () => {
    handleMenuClose();

    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        setActiveTab("LEASES");
        removeLeases();
        loadDeploymentDetail();

        event(AnalyticsEvents.CLOSE_DEPLOYMENT, {
          category: "deployments",
          label: "Close deployment in deployment detail"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  function onChangeName() {
    handleMenuClose();
    changeDeploymentName(deployment.dseq);
  }

  function handleMenuClick(ev) {
    setAnchorEl(ev.currentTarget);
  }

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const redeploy = () => {
    const url = UrlService.newDeployment({ redeploy: deployment.dseq });
    router.push(url);
  };

  const onDeploymentDeposit = async (deposit: number, depositorAddress: string) => {
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
        loadDeploymentDetail();

        event(AnalyticsEvents.DEPLOYMENT_DEPOSIT, {
          category: "deployments",
          label: "Deposit deployment in deployment detail"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: "0 .5rem .5rem"
        }}
      >
        <IconButton aria-label="back" onClick={handleBackClick} size="small">
          <ChevronLeftIcon />
        </IconButton>

        <Typography variant="h3" className={cx(classes.title, "text-truncate")}>
          {deploymentName ? deploymentName : "Deployment detail"}
        </Typography>

        <Box marginLeft=".5rem">
          <IconButton aria-label="back" onClick={() => loadDeploymentDetail()} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>

        {deployment?.state === "active" && (
          <Box className={classes.actionContainer}>
            <IconButton aria-label="settings" aria-haspopup="true" onClick={handleMenuClick} className={classes.actionButton} size="small">
              <MoreHorizIcon fontSize="medium" />
            </IconButton>
            <Button variant="contained" color="secondary" className={classes.actionButton} onClick={() => setIsDepositingDeployment(true)} size="small">
              Add funds
            </Button>

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
              <CustomMenuItem onClick={() => onChangeName()} icon={<EditIcon fontSize="small" />} text="Edit Name" />
              {storageDeploymentData?.manifest && <CustomMenuItem onClick={() => redeploy()} icon={<PublishIcon fontSize="small" />} text="Redeploy" />}
              <CustomMenuItem onClick={() => onCloseDeployment()} icon={<CancelPresentationIcon fontSize="small" />} text="Close" />
            </Menu>
          </Box>
        )}

        {deployment?.state === "closed" && (
          <Box className={classes.actionContainer}>
            <Button onClick={() => onChangeName()} variant="contained" className={classes.actionButton} color="secondary" size="small">
              <EditIcon fontSize="small" />
              &nbsp;Edit Name
            </Button>

            {storageDeploymentData?.manifest && (
              <Button onClick={() => redeploy()} variant="contained" className={classes.actionButton} color="secondary" size="small">
                <PublishIcon fontSize="small" />
                &nbsp;Redeploy
              </Button>
            )}
          </Box>
        )}
      </Box>

      {isDepositingDeployment && (
        <DeploymentDepositModal
          denom={deployment.escrowAccount.balance.denom}
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}
    </>
  );
};

