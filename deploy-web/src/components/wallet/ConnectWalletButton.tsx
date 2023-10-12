import React, { ReactNode, useState } from "react";
import { makeStyles } from "tss-react/mui";
import Box from "@mui/material/Box";
import Button, { ButtonProps } from "@mui/material/Button";
import { ConnectWalletModal } from "./ConnectWalletModal";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { useWallet } from "@src/context/WalletProvider";

interface Props extends ButtonProps {
  children?: ReactNode;
}

const useStyles = makeStyles()(theme => ({}));

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ ...rest }) => {
  const { isWalletConnected } = useWallet();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const { classes } = useStyles();

  const onConnectClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setIsConnectingWallet(true);
  };

  const onClose = () => {
    if (!isWalletConnected) {
      setIsConnectingWallet(false);
    }
  };

  return (
    <>
      {isConnectingWallet && <ConnectWalletModal onClose={onClose} />}

      <Button variant="outlined" color="secondary" onClick={onConnectClick} {...rest}>
        <AccountBalanceWalletIcon fontSize="small" />
        <Box component="span" sx={{ marginLeft: ".5rem", whiteSpace: "nowrap" }}>
          Connect Wallet
        </Box>
      </Button>
    </>
  );
};

