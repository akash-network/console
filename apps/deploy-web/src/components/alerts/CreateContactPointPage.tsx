import React from "react";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm";
import Layout from "@src/components/layout/Layout";

export const CreateContactPointPage: React.FunctionComponent = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Create Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Create Contact Point" returnable>
        <ContactPointCreateContainer>
          {props => <ContactPointForm isLoading={props.isLoading} onSubmit={props.create} onCancel={props.goBack} />}
        </ContactPointCreateContainer>
      </AlertsLayout>
    </Layout>
  );
};
