import React from "react";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import Layout from "@src/components/layout/Layout";

export const AlertsPage: React.FunctionComponent = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <AlertsLayout page={AlertTabs.ALERTS} title="Alerts" />
    </Layout>
  );
};
