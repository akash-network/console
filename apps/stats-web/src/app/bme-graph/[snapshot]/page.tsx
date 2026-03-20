import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowLeft } from "iconoir-react";
import type { Metadata } from "next";
import Link from "next/link";

import GraphContainer from "./GraphContainer";

import PageContainer from "@/components/PageContainer";
import { urlParamToBmeSnapshot } from "@/lib/snapshotsUrlHelpers";
import { UrlService } from "@/lib/urlUtils";
import type { BmeSnapshotsUrlParam } from "@/types";
import { BmeSnapshots } from "@/types";

interface IGraphProps {
  params: { snapshot: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { snapshot: snapshotUrlParam } }: IGraphProps): Promise<Metadata> {
  const snapshot = urlParamToBmeSnapshot(snapshotUrlParam as BmeSnapshotsUrlParam);
  const title = getTitle(snapshot as BmeSnapshots);

  return {
    title: title
  };
}

export default function BmeGraphPage({ params: { snapshot: snapshotUrlParam } }: IGraphProps) {
  const snapshot = urlParamToBmeSnapshot(snapshotUrlParam as BmeSnapshotsUrlParam);
  const title = getTitle(snapshot as BmeSnapshots);

  return (
    <PageContainer>
      <div className="m-auto max-w-3xl">
        <div className="mb-6 mt-6">
          <Link href={UrlService.bme()}>
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

const getTitle = (snapshot: BmeSnapshots): string => {
  switch (snapshot) {
    case BmeSnapshots.totalAktBurnedForAct:
      return "Total AKT Burned for ACT";
    case BmeSnapshots.dailyAktBurnedForAct:
      return "Daily AKT Burned for ACT";
    case BmeSnapshots.totalActMinted:
      return "Total ACT Minted";
    case BmeSnapshots.dailyActMinted:
      return "Daily ACT Minted";
    case BmeSnapshots.totalActBurnedForAkt:
      return "Total ACT Burned for AKT";
    case BmeSnapshots.dailyActBurnedForAkt:
      return "Daily ACT Burned for AKT";
    case BmeSnapshots.totalAktReminted:
      return "Total AKT Reminted";
    case BmeSnapshots.dailyAktReminted:
      return "Daily AKT Reminted";
    case BmeSnapshots.netAktBurned:
      return "Net AKT Burned";
    case BmeSnapshots.dailyNetAktBurned:
      return "Daily Net AKT Burned";
    case BmeSnapshots.outstandingAct:
      return "Outstanding ACT";
    case BmeSnapshots.vaultAkt:
      return "Vault AKT Balance";
    case BmeSnapshots.collateralRatio:
      return "Collateral Ratio";
    default:
      return "Graph not found.";
  }
};
