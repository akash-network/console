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

export const WithKeplrSection: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();

  return (
    <Box>
      <Link href={UrlService.getStartedWallet()} passHref>
        <Button startIcon={<ChevronLeftIcon />} sx={{ color: theme.palette.secondary.main }}>
          Back
        </Button>
      </Link>
      <Box component="ul" className={classes.list}>
        <li>
          Swap <ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="some tokens to AKT" />
        </li>

        <li>
          <ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw" /> AKT to Keplr
        </li>
        <li>Done!</li>
      </Box>
    </Box>
  );
};
