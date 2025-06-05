import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";

type Props = {
  alert: components["schemas"]["AlertOutputResponse"]["data"];
};

export const EditAlertPage: React.FunctionComponent<Props> = () => {
  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Contact Point" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Alert</Title>
      </div>
      TODO: Implement alert editing functionality
    </Layout>
  );
};
