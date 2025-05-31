import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import Layout from "@src/components/layout/Layout";

type Props = {
  contactPoint: components["schemas"]["ContactPointOutput"]["data"];
};

export const EditContactPointPage: React.FunctionComponent<Props> = (props: Props) => {
  // TODO: use ssr contact point
  console.log("DEBUG contactPoint", props.contactPoint);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Edit Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Edit Contact Point" returnable>
        TODO: Implement edit contact point functionality
      </AlertsLayout>
    </Layout>
  );
};
