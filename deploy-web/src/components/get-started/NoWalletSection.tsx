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

export const NoWalletSection: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();
  const [isCreateWalletOpen, setIsCreateWalletOpen] = useState(false);

  return (
    <Box>
      <Link href={UrlService.getStartedWallet()} passHref>
        <Button startIcon={<ChevronLeftIcon />} sx={{ color: theme.palette.secondary.main }}>
          Back
        </Button>
      </Link>
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

        <li>
          Click "Buy tokens" at the bottom left corner of the screen to Purchasing USDC on <ExternalLink href="https://app.osmosis.zone/" text="Osmosis" /> with
          Kado
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
