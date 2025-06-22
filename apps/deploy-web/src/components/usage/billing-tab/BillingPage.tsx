import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { UsageLayout, UsageTabs } from "@src/components/usage/UsageLayout";

export const BillingPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Billing" />
      <UsageLayout page={UsageTabs.BILLING}>
        <Title subTitle>TODO: Implement transactions list</Title>
      </UsageLayout>
    </Layout>
  );
};
