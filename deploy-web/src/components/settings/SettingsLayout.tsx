import React, { ReactNode, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../shared/ErrorFallback";
import { Container, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { UrlService } from "@src/utils/urlUtils";
import { useRouter } from "next/router";

export enum SettingsTabs {
  GENERAL = 1,
  AUTHORIZATIONS = 2
}

type Props = {
  page: SettingsTabs;
  children?: ReactNode;
  title: string;
  headerActions?: ReactNode;
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
  },
  titleContainer: {
    paddingBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap"
  }
}));

const SettingsLayout: React.FunctionComponent<Props> = ({ children, page, title, headerActions }) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();

  const handleTabChange = (event: React.SyntheticEvent, newValue: SettingsTabs) => {
    switch (newValue) {
      case SettingsTabs.AUTHORIZATIONS:
        router.push(UrlService.settingsAuthorizations());
        break;
      case SettingsTabs.GENERAL:
      default:
        router.push(UrlService.settings());
        break;
    }
  };

  return (
    <>
      <Tabs
        value={page}
        onChange={handleTabChange}
        classes={{ root: classes.tabsRoot, flexContainer: classes.tabsContainer }}
        indicatorColor="secondary"
        textColor="secondary"
      >
        <Tab value={SettingsTabs.GENERAL} label="General" classes={{ selected: classes.selectedTab }} />
        <Tab value={SettingsTabs.AUTHORIZATIONS} label="Authorizations" classes={{ selected: classes.selectedTab }} />
      </Tabs>

      <Container sx={{ paddingTop: "2rem" }}>
        <Box className={classes.titleContainer}>
          <Typography variant="h1" sx={{ fontSize: "2rem", fontWeight: "bold" }}>
            {title}
          </Typography>
          {headerActions}
        </Box>
      </Container>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </>
  );
};

export default SettingsLayout;
