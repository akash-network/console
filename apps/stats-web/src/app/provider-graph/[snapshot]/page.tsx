import React from "react";
import { ArrowLeft } from "iconoir-react";
import { Metadata } from "next";
import Link from "next/link";

import GraphContainer from "./GraphContainer";

import PageContainer from "@/components/PageContainer";
import { Button } from "@akashnetwork/ui/components";
import { urlParamToProviderSnapshot } from "@/lib/snapshotsUrlHelpers";
import { UrlService } from "@/lib/urlUtils";
import { ProviderSnapshots, ProviderSnapshotsUrlParam } from "@/types";

export interface IGraphProps {
  params: { snapshot: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { snapshot: snapshotUrlParam } }: IGraphProps): Promise<Metadata> {
  const snapshot = urlParamToProviderSnapshot(snapshotUrlParam as ProviderSnapshotsUrlParam);
  const title = getTitle(snapshot as ProviderSnapshots);

  return {
    title: title
  };
}

export default function ProviderGraphPage({ params: { snapshot: snapshotUrlParam } }: IGraphProps) {
  const snapshot = urlParamToProviderSnapshot(snapshotUrlParam as ProviderSnapshotsUrlParam);
  const title = getTitle(snapshot as ProviderSnapshots);

  return (
    <PageContainer>
      <div className="m-auto max-w-3xl">
        <div className="mb-8">
          <Link href={UrlService.home()}>
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
