"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import Layout from "@src/components/layout/Layout";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";

export default function ActionDetailsPage() {
  const searchParams = useSearchParams();
  const actionId = searchParams.get("id");

  if (!actionId) {
    return (
      <Layout>
        <div>Error: No action ID provided</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto">
        <ProviderActionDetails actionId={actionId} />
      </div>
    </Layout>
  );
}
