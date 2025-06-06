import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { AlertsListContainer } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import { AlertsListView } from "@src/components/alerts/AlertsListView/AlertsListView";
import Layout from "@src/components/layout/Layout";

export const AlertsPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <AlertsLayout page={AlertTabs.ALERTS} title="Alerts">
        <AlertsListContainer>{props => <AlertsListView {...props} />}</AlertsListContainer>
      </AlertsLayout>
    </Layout>
  );
};
