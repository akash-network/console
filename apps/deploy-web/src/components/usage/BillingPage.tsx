import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { UsageLayout, UsageTabs } from "@src/components/usage/UsageLayout";

export const BillingPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <UsageLayout page={UsageTabs.BILLING}>TODO: Implement transactions list</UsageLayout>
    </Layout>
  );
};
