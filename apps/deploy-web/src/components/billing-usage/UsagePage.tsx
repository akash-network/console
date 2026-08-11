import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { UsageContainer } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { UsageView } from "@src/components/billing-usage/UsageView/UsageView";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";

export const UsagePage: FC = () => {
  return (
    <Layout disableContainer containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Usage" />
      <SettingsLayout title="Usage" description="Track your spending and resource usage over time.">
        <UsageContainer>{props => <UsageView {...props} />}</UsageContainer>
      </SettingsLayout>
    </Layout>
  );
};
