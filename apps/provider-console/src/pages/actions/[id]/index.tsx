"use client";

import React from "react";

import { Layout } from "@src/components/layout/Layout";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";

type Props = {
  id: string | null;
};

const ActionDetailsPage: React.FC<Props> = ({ id }) => {
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
        <ProviderActionDetails actionId={id} />
      </div>
    </Layout>
  );
};

export default ActionDetailsPage;

// export default withAuth(ActionDetailsPage);

export async function getServerSideProps({ params }) {
  return {
    props: {
      id: params?.id
    }
  };
}
