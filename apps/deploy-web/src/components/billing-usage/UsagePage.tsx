import React, { type FC } from "react";
import { NextSeo } from "next-seo";

import { UsageContainer } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { UsageHeaderActions } from "@src/components/billing-usage/UsageHeaderActions/UsageHeaderActions";
import { UsageView } from "@src/components/billing-usage/UsageView/UsageView";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";

export const UsagePage: FC = () => {
  return (
    <Layout background="dots" disableContainer containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Usage" />
      <UsageContainer>
        {({ onExport, canExport, ...props }) => (
          <SettingsLayout
            title="Usage"
            description="Track your spending and resource usage over time."
            headerActions={
              <UsageHeaderActions
                datePreset={props.datePreset}
                onDatePresetChange={props.onDatePresetChange}
                onExport={onExport}
                isExportDisabled={!canExport}
              />
            }
          >
            <UsageView {...props} />
          </SettingsLayout>
        )}
      </UsageContainer>
    </Layout>
  );
};
