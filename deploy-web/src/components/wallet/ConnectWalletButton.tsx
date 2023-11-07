import React, { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button, { ButtonProps } from "@mui/material/Button";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { useChain } from "@cosmos-kit/react";

interface Props extends ButtonProps {
  children?: ReactNode;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ ...rest }) => {
  const { connect } = useChain("akash");

  return (
    <Button variant="outlined" color="secondary" onClick={() => connect()} {...rest}>
      <AccountBalanceWalletIcon fontSize="small" />
      <Box component="span" sx={{ marginLeft: ".5rem", whiteSpace: "nowrap" }}>
        Connect Wallet
      </Box>
    </Button>
  );
};
