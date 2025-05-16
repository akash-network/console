import React from "react";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { CreateContactPointFormContainer } from "@src/components/alerts/ContactPointFormContainer";
import Layout from "@src/components/layout/Layout";

export const CreateContactPointPage: React.FunctionComponent = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Create Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Create Contact Point" returnable>
        <CreateContactPointFormContainer />
      </AlertsLayout>
    </Layout>
  );
};
