import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import Layout from "@src/components/layout/Layout";

export const ContactPointsPage: React.FunctionComponent = () => {
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
      />
    </Layout>
  );
};
