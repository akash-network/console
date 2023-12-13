"use client";
import React, { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { UrlService } from "@/lib/urlUtils";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AddressTab = "address" | "transactions" | "deployments";
type Props = {
  address: string;
  children?: ReactNode;
  page: AddressTab;
};

// const useStyles = makeStyles()(theme => ({
//   title: {
//     fontSize: "2rem",
//     fontWeight: "bold",
//     marginBottom: "1rem"
//   },
//   titleSmall: {
//     fontSize: "1.1rem"
//   },
//   selectedTab: {
//     fontWeight: "bold"
//   }
// }));

export default function AddressLayout({ children, page, address }: Props) {
  // const { classes } = useStyles();
  const router = useRouter();

  const handleTabChange = (newValue: string) => {
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
      <Title>Account Detail</Title>

      <Tabs
        value={page}
        onValueChange={handleTabChange}
        // aria-label="address tabs"
        // textColor="secondary"
        // indicatorColor="secondary"
        // variant="scrollable"
        // scrollButtons="auto"
      >
        {/* <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "1rem" }}> */}
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>
        {/* </Box> */}

        {/* <Tab
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
        /> */}

        {children}
      </Tabs>
    </PageContainer>
  );
}
