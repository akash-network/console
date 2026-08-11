import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { AccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/AccountBalanceOverview";
import { AddToBalanceButton } from "@src/components/billing-usage/AddToBalanceButton/AddToBalanceButton";
import { AutoTopUpSection } from "@src/components/billing-usage/AutoTopUpSection/AutoTopUpSection";
import { BillingContainer } from "@src/components/billing-usage/BillingContainer/BillingContainer";
import { BillingUsageLayout, BillingUsageTabs } from "@src/components/billing-usage/BillingUsageLayout";
import { BillingView } from "@src/components/billing-usage/BillingView/BillingView";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useFlag } from "@src/hooks/useFlag";

export const BillingPage: FC = () => {
  const isAutoCreditReloadEnabled = useFlag("auto_credit_reload");

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <BillingUsageLayout page={BillingUsageTabs.BILLING}>
        <div className="space-y-6">
          {isAutoCreditReloadEnabled && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Title subTitle>Your account</Title>
                <AddToBalanceButton />
              </div>
              <AccountBalanceOverview />
              <AutoTopUpSection />
            </div>
          )}
          <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
        </div>
      </BillingUsageLayout>
    </Layout>
  );
};
