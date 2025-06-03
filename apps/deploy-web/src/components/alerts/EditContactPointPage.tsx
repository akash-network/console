import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { ContactPointEditContainer } from "@src/components/alerts/ContactPointEditContainer/ContactPointEditContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm/ContactPointForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  contactPoint: components["schemas"]["ContactPointOutput"]["data"];
};

export const EditContactPointPage: React.FunctionComponent<Props> = ({ contactPoint }: Props) => {
  const router = useRouter();

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Contact Point" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Contact Point</Title>
      </div>
      <ContactPointEditContainer id={contactPoint.id} onEditSuccess={() => router.push(UrlService.contactPoints())}>
        {props => (
          <ContactPointForm
            initialValues={{
              name: contactPoint.name,
              emails: contactPoint.config.addresses
            }}
            isLoading={props.isLoading}
            onSubmit={props.onEdit}
            onCancel={() => router.push(UrlService.contactPoints())}
          />
        )}
      </ContactPointEditContainer>
    </Layout>
  );
};
