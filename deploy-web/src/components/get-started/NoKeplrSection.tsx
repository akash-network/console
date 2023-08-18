import React, { useState } from "react";
import { makeStyles } from "tss-react/mui";
import { Alert, Box, Button, Collapse, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { ExternalLink } from "../shared/ExternalLink";
import { CreateWalletSection } from "./CreateWalletSection";
import { LinkTo } from "../shared/LinkTo";

const useStyles = makeStyles()(theme => ({
  list: {
    listStyle: "numeric",
    "& li": {
      marginBottom: theme.spacing(0.5),

      "&:last-child": {
        marginBottom: 0
      }
    }
  }
}));

type Props = {};

export const NoKeplrSection: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();
  const [isCreateWalletOpen, setIsCreateWalletOpen] = useState(false);

  return (
    <Box>
      <Button href={UrlService.getStartedWallet()} component={Link} startIcon={<ChevronLeftIcon />} sx={{ color: theme.palette.secondary.main }}>
        Back
      </Button>
      <Box component="ul" className={classes.list}>
        <li>
          Install <ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr" />
        </li>
        <li>
          Create a wallet using{" "}
          <LinkTo sx={{ fontSize: "initial" }} onClick={() => setIsCreateWalletOpen(prev => !prev)}>
            Keplr
          </LinkTo>
        </li>

        <Collapse in={isCreateWalletOpen}>
          <Alert variant="outlined" severity="info" icon={false} sx={{ margin: "1rem 0 " }}>
            <CreateWalletSection />
          </Alert>
        </Collapse>

        <li>Use a decentralized or centralized exchange to purchase USDC</li>

        <li>
          Use <ExternalLink href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" text="MetaMask" /> wallet to import USDC
          to <ExternalLink href="https://app.osmosis.zone/assets" text="Osmosis" />
        </li>

        <li>
          Swap <ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="USDC to AKT" />
        </li>

        <li>
          <ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw" /> AKT to Keplr
        </li>
        <li>Done!</li>
      </Box>
    </Box>
  );
};
