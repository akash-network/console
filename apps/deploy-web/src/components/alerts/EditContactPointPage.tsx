import React from "react";
import { useParams, useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { ContactPointEditContainer } from "@src/components/alerts/ContactPointEditContainer/ContactPointEditContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm/ContactPointForm";
import Layout from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

export const EditContactPointPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = useParams();
  const contactPointId = Array.isArray(id) ? id[0] : id;

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Edit Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Edit Contact Point" returnable>
        <ContactPointEditContainer id={contactPointId} onEdit={() => router.push(UrlService.contactPoints())}>
          {props => (
            <ContactPointForm
              values={props.values}
              isLoading={props.isLoading}
              onSubmit={props.onEdit}
              onCancel={() => router.push(UrlService.contactPoints())}
            />
          )}
        </ContactPointEditContainer>
      </AlertsLayout>
    </Layout>
  );
};
