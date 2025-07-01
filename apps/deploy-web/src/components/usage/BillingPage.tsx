import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { BillingContainer } from "@src/components/usage/billing-tab/BillingContainer";
import { BillingView } from "@src/components/usage/billing-tab/BillingView";
import { UsageLayout, UsageTabs } from "@src/components/usage/UsageLayout";

export const BillingPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <UsageLayout page={UsageTabs.BILLING}>
        <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
      </UsageLayout>
    </Layout>
  );
};
