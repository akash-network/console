import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { type ContactPoint, ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { ContactPointsListView } from "@src/components/alerts/ContactPointsListView/ContactPointsListView";
import Layout from "@src/components/layout/Layout";

export const ContactPointsPage: React.FunctionComponent = () => {
  const router = useRouter();

  const edit = (id: ContactPoint["id"]) => {
    router.push(`/alerts/contact-points/${id}`);
  };

  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <AlertsLayout
        page={AlertTabs.CONTACT_POINTS}
        title="Contact Points"
        headerActions={
          <div className="md:ml-4">
            <Link href="contact-points/new" color="secondary" type="button" className={cn(buttonVariants({ variant: "default" }))}>
              <Plus />
              &nbsp;Create
            </Link>
          </div>
        }
      >
        <ContactPointsListContainer edit={edit}>{props => <ContactPointsListView {...props} />}</ContactPointsListContainer>
      </AlertsLayout>
    </Layout>
  );
};
