import React from "react";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm/ContactPointForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useBackNav } from "@src/hooks/useBackNav";
import { UrlService } from "@src/utils/urlUtils";

export const CreateContactPointPage: React.FunctionComponent = () => {
  const goBack = useBackNav(UrlService.contactPoints());

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Create Contact Point" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Create Contact Point</Title>
      </div>
      <ContactPointCreateContainer onCreate={goBack}>
        {props => <ContactPointForm isLoading={props.isLoading} onSubmit={props.create} onCancel={goBack} />}
      </ContactPointCreateContainer>
    </Layout>
  );
};
