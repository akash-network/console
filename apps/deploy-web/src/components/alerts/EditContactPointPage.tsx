import React from "react";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import Layout from "@src/components/layout/Layout";

export const EditContactPointPage: React.FunctionComponent = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Edit Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Edit Contact Point" returnable>
        TODO: Implement edit contact point functionality
      </AlertsLayout>
    </Layout>
  );
};
