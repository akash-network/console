import React from "react";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ContactPointForm } from "@src/components/alerts/ContactPointForm/ContactPointForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

export const CreateContactPointPage: React.FunctionComponent = () => {
  const router = useRouter();

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Create Contact Point" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Create Contact Point</Title>
      </div>
      <ContactPointCreateContainer onCreate={router.back}>
        {props => <ContactPointForm isLoading={props.isLoading} onSubmit={props.create} onCancel={() => router.push(UrlService.contactPoints())} />}
      </ContactPointCreateContainer>
    </Layout>
  );
};
