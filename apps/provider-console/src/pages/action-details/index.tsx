"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";
import Layout from "@src/components/layout/Layout";
import { Separator } from "@akashnetwork/ui/components";

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
      <div className="container mx-auto px-4 py-8">
        <ProviderActionDetails actionId={actionId} />
      </div>
    </Layout>
  );
}
