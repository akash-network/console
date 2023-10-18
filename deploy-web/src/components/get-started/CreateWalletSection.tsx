import React from "react";
import { makeStyles } from "tss-react/mui";
import { Alert, Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { ExternalLink } from "../shared/ExternalLink";

const useStyles = makeStyles()(theme => ({
  list: {
    listStyle: "lower-alpha",
    "& li": {
      marginBottom: theme.spacing(0.5),

      "&:last-child": {
        marginBottom: 0
      }
    }
  }
}));

type Props = {
  // backUrl: string;
};

export const CreateWalletSection: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();

  return (
    <Box component="ul" className={classes.list}>
      <li>
        Navigate to the <ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr Wallet extension" />{" "}
        in the Google Chrome store and follow the on-screen prompts to add the extension to your web browser
      </li>
      <li>Open the browser extension and select Create new account.</li>
      <li>Copy your mnemonic seed phrase and store it somewhere safe</li>
      <Alert severity="warning" sx={{ margin: ".5rem  0 1rem" }}>
        Ensure that you store your mnemonic seed phrase somewhere safe where it cannot be lost or compromised. Your mnemonic seed phrase is the master key to
        your wallet; loss or compromise of your mnemonic seed phrase may result in permanent loss of your ATOM.
      </Alert>
      <li>Establish an account name and password, then select Next.</li>
      <li>Confirm your mnemonic seed phrase and select Register.</li>
      <li>Done!</li>
    </Box>
  );
};
