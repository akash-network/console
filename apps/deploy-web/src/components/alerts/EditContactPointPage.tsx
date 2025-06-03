import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { ContactPointEditContainer } from "@src/components/alerts/ContactPointEditContainer/ContactPointEditContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm/ContactPointForm";
import Layout from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  contactPoint: components["schemas"]["ContactPointOutput"]["data"];
};

export const EditContactPointPage: React.FunctionComponent<Props> = (props: Props) => {
  const router = useRouter();
  // TODO: use ssr contact point
  console.log("DEBUG contactPoint", props.contactPoint);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Edit Contact Point" />
      <AlertsLayout page={AlertTabs.CONTACT_POINTS} title="Edit Contact Point" returnable>
        <ContactPointEditContainer id={props.contactPoint.id} onEdit={() => router.push(UrlService.contactPoints())}>
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
