import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { BillingContainer } from "@src/components/billing-usage/BillingContainer/BillingContainer";
import { BillingUsageLayout, BillingUsageTabs } from "@src/components/billing-usage/BillingUsageLayout";
import { BillingView } from "@src/components/billing-usage/BillingView/BillingView";
import Layout from "@src/components/layout/Layout";

export const BillingPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <BillingUsageLayout page={BillingUsageTabs.BILLING}>
        <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
      </BillingUsageLayout>
    </Layout>
  );
};
