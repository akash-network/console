import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { Button } from "@akashnetwork/ui/components";
import { ArrowLeft } from "iconoir-react";

import GraphContainer from "./GraphContainer";

import PageContainer from "@/components/PageContainer";
import { urlParamToSnapshot } from "@/lib/snapshotsUrlHelpers";
import { UrlService } from "@/lib/urlUtils";
import type { SnapshotsUrlParam } from "@/types";
import { Snapshots } from "@/types";

export function GraphPage() {
  const { snapshot: snapshotUrlParam } = useParams<{ snapshot: string }>();
  const snapshot = urlParamToSnapshot(snapshotUrlParam as SnapshotsUrlParam);
  const title = getTitle(snapshot as Snapshots);

  return (
    <>
      <Helmet>
        <title>{title} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <div className="m-auto max-w-3xl">
          <div className="mb-6 mt-6">
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
