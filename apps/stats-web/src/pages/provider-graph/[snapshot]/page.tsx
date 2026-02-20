import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { Button } from "@akashnetwork/ui/components";
import { ArrowLeft } from "iconoir-react";

import GraphContainer from "./GraphContainer";

import { PageContainer } from "@/components/PageContainer";
import { urlParamToProviderSnapshot } from "@/lib/snapshotsUrlHelpers";
import { UrlService } from "@/lib/urlUtils";
import type { ProviderSnapshotsUrlParam } from "@/types";
import { ProviderSnapshots } from "@/types";

export function ProviderGraphPage() {
  const { snapshot: snapshotUrlParam } = useParams<{ snapshot: string }>();
  const snapshot = urlParamToProviderSnapshot(snapshotUrlParam as ProviderSnapshotsUrlParam);
  const title = getTitle(snapshot as ProviderSnapshots);

  return (
    <>
      <Helmet>
        <title>{title} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <div className="m-auto max-w-3xl">
          <div className="mb-8">
            <Link to={UrlService.home()}>
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          </div>

          <div className="mb-2">
            <h1 className="text-center text-3xl font-normal tracking-tight sm:text-left">{title}</h1>
          </div>

          <GraphContainer snapshot={snapshot} />
        </div>
      </PageContainer>
    </>
  );
}

const getTitle = (snapshot: ProviderSnapshots): string => {
  switch (snapshot) {
    case ProviderSnapshots.count:
      return "Active Providers";
    case ProviderSnapshots.cpu:
      return "CPU Capacity";
    case ProviderSnapshots.gpu:
      return "GPU Capacity";
    case ProviderSnapshots.memory:
      return "Memory Capacity";
    case ProviderSnapshots.storage:
      return "Disk Storage Capacity";

    default:
      return "Graph not found.";
  }
};
