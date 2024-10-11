"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";
import Layout from "@src/components/layout/Layout";
import { Separator } from "@akashnetwork/ui/components";

export default function ActionDetailsPage() {
  const searchParams = useSearchParams();
  const actionId = searchParams.get('id');

  if (!actionId) {
    return (
      <Layout>
        <div>Error: No action ID provided</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Action Details</h1>
        <Separator className="my-4" />
        <ProviderActionDetails actionId={actionId} />
      </div>
    </Layout>
  );
}
