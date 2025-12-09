import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { BillingUsageLayout, BillingUsageTabs } from "@src/components/billing-usage/BillingUsageLayout";
import Layout from "@src/components/layout/Layout";
import { PaymentMethodsContainer } from "./PaymentMethodsContainer/PaymentMethodsContainer";
import { PaymentMethodsView } from "./PaymentMethodsView/PaymentMethodsView";

export const PaymentMethodsPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Payment Methods" />
      <BillingUsageLayout page={BillingUsageTabs.PAYMENT_METHODS}>
        <PaymentMethodsContainer>{props => <PaymentMethodsView {...props} />}</PaymentMethodsContainer>
      </BillingUsageLayout>
    </Layout>
  );
};
