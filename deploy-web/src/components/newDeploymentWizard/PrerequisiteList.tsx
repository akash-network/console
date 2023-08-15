import React, { useEffect, useState } from "react";
import { List, ListItem, ListItemText, ListItemIcon, CircularProgress, Box, useTheme, Paper } from "@mui/material";
import { green } from "@mui/material/colors";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { makeStyles } from "tss-react/mui";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ConnectWallet } from "../shared/ConnectWallet";
import { Popup } from "../shared/Popup";

const useStyles = makeStyles()(theme => ({
  list: {
    paddingTop: 0,
    paddingBottom: "1rem"
  }
}));

type Props = {
  onClose: () => void;
  onContinue: () => void;
};

export const PrerequisiteList: React.FunctionComponent<Props> = ({ onClose, onContinue }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(false);
  const [isBalanceValidated, setIsBalanceValidated] = useState(null);
  const { address, walletBalances, refreshBalances } = useKeplr();

  useEffect(() => {
    async function loadPrerequisites() {
      setIsLoadingPrerequisites(true);

      const balance = await refreshBalances();
      const isBalanceValidated = balance.uakt >= 5000000;

      setIsBalanceValidated(isBalanceValidated);
      setIsLoadingPrerequisites(false);

      if (isBalanceValidated) {
        onContinue();
      }
    }

    if (address) {
      loadPrerequisites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalances?.uakt]);

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Continue",
          color: "secondary",
          variant: "contained",
          side: "right",
          isLoading: isLoadingPrerequisites,
          onClick: onContinue
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick={false}
      title="Checking Prerequisites"
    >
      {address ? (
        <Paper sx={{ padding: "1rem" }}>
          <List className={classes.list}>
            <ListItem>
              <ListItemIcon>
                {isBalanceValidated === null && <CircularProgress color="secondary" />}
                {isBalanceValidated === true && <CheckCircleOutlineIcon fontSize="large" style={{ color: green[500] }} />}
                {isBalanceValidated === false && <ErrorOutlineIcon fontSize="large" color="secondary" />}
              </ListItemIcon>
              <ListItemText
                primary="Wallet Balance"
                secondary="The balance of the wallet needs to be of at least 5 AKT. If you do not have 5 AKT, you will need to specify an authorized depositor."
              />
            </ListItem>
          </List>
        </Paper>
      ) : (
        <Box sx={{ padding: "2rem 0" }}>
          <ConnectWallet text="Connect your wallet to deploy!" />
        </Box>
      )}
    </Popup>
  );
};
