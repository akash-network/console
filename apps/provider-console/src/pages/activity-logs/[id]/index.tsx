"use client";

import React from "react";

import { Layout } from "@src/components/layout/Layout";
import { ActivityLogDetails } from "@src/components/shared/ActivityLogDetails";

type Props = {
  id: string | null;
};

const ActivityLogDetailsPage: React.FC<Props> = ({ id }) => {
  if (!id) {
    return (
      <Layout>
        <div>Error: No action ID provided</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto">
        <ActivityLogDetails actionId={id} />
      </div>
    </Layout>
  );
};

export default ActivityLogDetailsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      id: params?.id
    }
  };
}
