import React, { ReactNode, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../shared/ErrorFallback";
import { Button, Container, IconButton, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import ViewPanel from "../shared/ViewPanel";
import { UrlService } from "@src/utils/urlUtils";
import { useRouter } from "next/router";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageContainer from "../shared/PageContainer";
import { ProviderSummary } from "./ProviderSummary";
import { ProviderDetail } from "@src/types/provider";
import Link from "next/link";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";

export enum ProviderDetailTabs {
  DETAIL = 1,
  LEASES = 2,
  RAW = 3
}

type Props = {
  page: ProviderDetailTabs;
  provider: Partial<ProviderDetail>;
  address: string;
  refresh: () => void;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  tabsRoot: {
    minHeight: "36px",
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
    "& button": {
      minHeight: "36px"
    }
  },
  selectedTab: {
    fontWeight: "bold"
  },
  tabsContainer: {
    justifyContent: "center"
  }
}));

const ProviderDetailLayout: React.FunctionComponent<Props> = ({ children, page, address, provider, refresh }) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();
  const { address: walletAddress } = useKeplr();
  const previousRoute = usePreviousRoute();

  const handleTabChange = (event: React.SyntheticEvent, newValue: ProviderDetailTabs) => {
    switch (newValue) {
      case ProviderDetailTabs.LEASES:
        router.push(UrlService.providerDetailLeases(address));
        break;
      case ProviderDetailTabs.RAW:
        router.push(UrlService.providerDetailRaw(address));
        break;
      case ProviderDetailTabs.DETAIL:
      default:
        router.push(UrlService.providerDetail(address));
        break;
    }
  };

  function handleBackClick() {
    if (previousRoute !== router.asPath) {
      router.back();
    } else {
      router.push(UrlService.providers());
    }
  }

  return (
    <PageContainer>
      <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
        <IconButton aria-label="back" onClick={handleBackClick} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          variant="h1"
          sx={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginLeft: ".5rem"
          }}
        >
          Provider detail
        </Typography>

        <Box marginLeft="1rem">
          <IconButton aria-label="back" onClick={() => refresh()} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>

        {provider && walletAddress === address && (
          <Box sx={{ marginLeft: "1rem" }}>
            <Button href={UrlService.providerDetailEdit(provider.owner)} component={Link} size="small" variant="contained" color="secondary">
              Edit
            </Button>
          </Box>
        )}
      </Box>

      {provider && (
        <>
          <ProviderSummary provider={provider} />

          <Tabs
            value={page}
            onChange={handleTabChange}
            classes={{ root: classes.tabsRoot, flexContainer: classes.tabsContainer }}
            indicatorColor="secondary"
            textColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value={ProviderDetailTabs.DETAIL} label="Detail" classes={{ selected: classes.selectedTab }} />
            <Tab value={ProviderDetailTabs.LEASES} label="My Leases" classes={{ selected: classes.selectedTab }} />
            <Tab value={ProviderDetailTabs.RAW} label="Raw Data" classes={{ selected: classes.selectedTab }} />
          </Tabs>
        </>
      )}

      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Box sx={{ paddingTop: "2rem" }}>{children}</Box>
      </ErrorBoundary>
    </PageContainer>
  );
};

export default ProviderDetailLayout;
