import React, { ReactNode, useState } from "react";
import PageContainer from "../shared/PageContainer";
import { Box, Tab, Tabs } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { a11yTabProps } from "@src/utils/a11y";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";

type AddressTab = "address" | "transactions" | "deployments";
type Props = {
  address: string;
  children?: ReactNode;
  page: AddressTab;
};

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: "2rem",
    fontWeight: "bold",
    marginBottom: "1rem"
  },
  titleSmall: {
    fontSize: "1.1rem"
  },
  selectedTab: {
    fontWeight: "bold"
  }
}));

const AddressLayout: React.FunctionComponent<Props> = ({ children, page, address }) => {
  const { classes } = useStyles();
  const router = useRouter();

  const handleTabChange = (event: React.SyntheticEvent, newValue: AddressTab) => {
    switch (newValue) {
      case "transactions":
        router.push(UrlService.addressTransactions(address));
        break;
      case "deployments":
        router.push(UrlService.addressDeployments(address));
        break;
      case "address":
      default:
        router.push(UrlService.address(address));
        break;
    }
  };

  return (
    <PageContainer>
      <Title value="Account Detail" />

      <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "1rem" }}>
        <Tabs
          value={page}
          onChange={handleTabChange}
          aria-label="address tabs"
          textColor="secondary"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value="address"
            label="Address"
            {...a11yTabProps("address-tab", "address-tab-panel", 0)}
            classes={{ selected: classes.selectedTab }}
            onClick={() => {
              event(AnalyticsEvents.ADDRESSES_ADDRESS_TAB, {
                category: "addresses",
                label: "Click on address tab"
              });
            }}
          />
          <Tab
            value="transactions"
            label="Transactions"
            {...a11yTabProps("transactions-tab", "transactions-tab-panel", 1)}
            classes={{ selected: classes.selectedTab }}
            onClick={() => {
              event(AnalyticsEvents.ADDRESSES_TRANSACTIONS_TAB, {
                category: "addresses",
                label: "Click on transactions tab"
              });
            }}
          />
          <Tab
            value="deployments"
            label="Deployments"
            {...a11yTabProps("deployments-tab", "deployments-tab-panel", 1)}
            classes={{ selected: classes.selectedTab }}
            onClick={() => {
              event(AnalyticsEvents.ADDRESSES_DEPLOYMENTS_TAB, {
                category: "addresses",
                label: "Click on deployments tab"
              });
            }}
          />
        </Tabs>
      </Box>

      {children}
    </PageContainer>
  );
};

export default AddressLayout;
