import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { AccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/AccountBalanceOverview";
import { AddToBalanceButton } from "@src/components/billing-usage/AddToBalanceButton/AddToBalanceButton";
import { AutoTopUpSection } from "@src/components/billing-usage/AutoTopUpSection/AutoTopUpSection";
import { BillingActionsProvider } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { BillingContainer } from "@src/components/billing-usage/BillingContainer/BillingContainer";
import { BillingView } from "@src/components/billing-usage/BillingView/BillingView";
import { PaymentMethodsContainer } from "@src/components/billing-usage/PaymentMethodsContainer/PaymentMethodsContainer";
import { PaymentMethodsView } from "@src/components/billing-usage/PaymentMethodsView/PaymentMethodsView";
import { useBillingBackgroundLoading } from "@src/components/billing-usage/useBillingBackgroundLoading";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { useFlag } from "@src/hooks/useFlag";

export const BillingPage: FC = () => {
  const isAutoCreditReloadEnabled = useFlag("auto_credit_reload");
  const isBackgroundLoading = useBillingBackgroundLoading();

  return (
    <Layout isLoading={isBackgroundLoading} disableContainer containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <SettingsLayout
        title="Billing"
        description="Manage your balance, payment methods, and payment history."
        headerActions={isAutoCreditReloadEnabled ? <AddToBalanceButton /> : undefined}
      >
        {isAutoCreditReloadEnabled ? (
          <BillingActionsProvider>
            <AccountBalanceOverview />
            <AutoTopUpSection />
            <PaymentMethodsContainer>{props => <PaymentMethodsView {...props} />}</PaymentMethodsContainer>
            <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
          </BillingActionsProvider>
        ) : (
          <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
        )}
      </SettingsLayout>
    </Layout>
  );
};
