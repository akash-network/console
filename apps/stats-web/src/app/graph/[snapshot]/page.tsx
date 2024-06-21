import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowLeft } from "iconoir-react";
import { Metadata } from "next";
import Link from "next/link";

import GraphContainer from "./GraphContainer";

import PageContainer from "@/components/PageContainer";
import { urlParamToSnapshot } from "@/lib/snapshotsUrlHelpers";
import { UrlService } from "@/lib/urlUtils";
import { Snapshots, SnapshotsUrlParam } from "@/types";

interface IGraphProps {
  params: { snapshot: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { snapshot: snapshotUrlParam } }: IGraphProps): Promise<Metadata> {
  const snapshot = urlParamToSnapshot(snapshotUrlParam as SnapshotsUrlParam);
  const title = getTitle(snapshot as Snapshots);

  return {
    title: title
  };
}

export default function GraphPage({ params: { snapshot: snapshotUrlParam } }: IGraphProps) {
  const snapshot = urlParamToSnapshot(snapshotUrlParam as SnapshotsUrlParam);
  const title = getTitle(snapshot as Snapshots);

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

const getTitle = (snapshot: Snapshots): string => {
  switch (snapshot) {
    case Snapshots.activeLeaseCount:
      return "Active leases";
    case Snapshots.totalUAktSpent:
      return "Total AKT spent";
    case Snapshots.totalUUsdcSpent:
      return "Total USDC spent";
    case Snapshots.totalUUsdSpent:
      return "Total USD spent";
    case Snapshots.totalLeaseCount:
      return "All-time lease count";
    case Snapshots.activeCPU:
      return "CPU leased";
    case Snapshots.activeGPU:
      return "GPU leased";
    case Snapshots.activeMemory:
      return "Memory leased";
    case Snapshots.activeStorage:
      return "Disk storage leased";
    case Snapshots.dailyUAktSpent:
      return "Daily AKT spent";
    case Snapshots.dailyUUsdcSpent:
      return "Daily USDC spent";
    case Snapshots.dailyUUsdSpent:
      return "Daily USD spent";
    case Snapshots.dailyLeaseCount:
      return "Daily new leases";

    default:
      return "Graph not found.";
  }
};
