import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { BillingUsageLayout } from "@src/components/billing-usage/BillingUsageLayout";
import { UsageContainer } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { UsageView } from "@src/components/billing-usage/UsaveView/UsageView";
import Layout from "@src/components/layout/Layout";

export const UsagePage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Usage" />
      <BillingUsageLayout>
        <UsageContainer>{props => <UsageView {...props} />}</UsageContainer>
      </BillingUsageLayout>
    </Layout>
  );
};
