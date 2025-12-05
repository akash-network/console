import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { BillingContainer } from "@src/components/billing-usage/BillingContainer/BillingContainer";
import { BillingUsageLayout, BillingUsageTabs } from "@src/components/billing-usage/BillingUsageLayout";
import { BillingView } from "@src/components/billing-usage/BillingView/BillingView";
import Layout from "@src/components/layout/Layout";
import { useFlag } from "@src/hooks/useFlag";
import { AccountOverview } from "./AccountOverview/AccountOverview";

export const BillingPage: FC = () => {
  const isAutoCreditReloadEnabled = useFlag("auto_credit_reload");

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <BillingUsageLayout page={BillingUsageTabs.BILLING}>
        {isAutoCreditReloadEnabled && <AccountOverview />}
        <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
      </BillingUsageLayout>
    </Layout>
  );
};
