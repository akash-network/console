import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { UsageContainer } from "@src/components/usage/UsageContainer/UsageContainer";
import { UsageLayout, UsageTabs } from "@src/components/usage/UsageLayout";
import { UsageView } from "@src/components/usage/UsaveView/UsageView";

export const UsagePage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Usage" />
      <UsageLayout page={UsageTabs.USAGE}>
        <UsageContainer>{props => <UsageView {...props} />}</UsageContainer>
      </UsageLayout>
    </Layout>
  );
};
