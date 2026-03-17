"use client";
import { Spinner } from "@akashnetwork/ui/components";

import { BmeDashboard } from "./BmeDashboard";

import { Title } from "@/components/Title";
import { useBmeStatusHistory, useGraphSnapshot } from "@/queries";
import { BmeSnapshots } from "@/types";

export const BmeDashboardContainer: React.FunctionComponent = () => {
  const { data: outstandingActData, isLoading: isLoadingOutstandingAct } = useGraphSnapshot(BmeSnapshots.outstandingAct);
  const { data: vaultAktData, isLoading: isLoadingVaultAkt } = useGraphSnapshot(BmeSnapshots.vaultAkt);
  const { data: collateralRatioData, isLoading: isLoadingCollateralRatio } = useGraphSnapshot(BmeSnapshots.collateralRatio);
  const { data: statusHistory, isLoading: isLoadingStatusHistory } = useBmeStatusHistory();
  const { data: dailyAktBurnedForActData, isLoading: isLoadingDailyAktBurnedForAct } = useGraphSnapshot(BmeSnapshots.dailyAktBurnedForAct);
  const { data: totalAktBurnedForActData, isLoading: isLoadingTotalAktBurnedForAct } = useGraphSnapshot(BmeSnapshots.totalAktBurnedForAct);
  const { data: dailyActMintedData, isLoading: isLoadingDailyActMinted } = useGraphSnapshot(BmeSnapshots.dailyActMinted);
  const { data: totalActMintedData, isLoading: isLoadingTotalActMinted } = useGraphSnapshot(BmeSnapshots.totalActMinted);
  const { data: dailyActBurnedForAktData, isLoading: isLoadingDailyActBurnedForAkt } = useGraphSnapshot(BmeSnapshots.dailyActBurnedForAkt);
  const { data: totalActBurnedForAktData, isLoading: isLoadingTotalActBurnedForAkt } = useGraphSnapshot(BmeSnapshots.totalActBurnedForAkt);
  const { data: dailyAktRemintedData, isLoading: isLoadingDailyAktReminted } = useGraphSnapshot(BmeSnapshots.dailyAktReminted);
  const { data: totalAktRemintedData, isLoading: isLoadingTotalAktReminted } = useGraphSnapshot(BmeSnapshots.totalAktReminted);
  const { data: dailyNetAktBurnedData, isLoading: isLoadingDailyNetAktBurned } = useGraphSnapshot(BmeSnapshots.dailyNetAktBurned);
  const { data: netAktBurnedData, isLoading: isLoadingNetAktBurned } = useGraphSnapshot(BmeSnapshots.netAktBurned);

  const isLoading =
    isLoadingOutstandingAct ||
    isLoadingVaultAkt ||
    isLoadingCollateralRatio ||
    isLoadingStatusHistory ||
    isLoadingDailyAktBurnedForAct ||
    isLoadingTotalAktBurnedForAct ||
    isLoadingDailyActMinted ||
    isLoadingTotalActMinted ||
    isLoadingDailyActBurnedForAkt ||
    isLoadingTotalActBurnedForAkt ||
    isLoadingDailyAktReminted ||
    isLoadingTotalAktReminted ||
    isLoadingDailyNetAktBurned ||
    isLoadingNetAktBurned;

  const hasData =
    outstandingActData &&
    vaultAktData &&
    collateralRatioData &&
    dailyAktBurnedForActData &&
    totalAktBurnedForActData &&
    dailyActMintedData &&
    totalActMintedData &&
    dailyActBurnedForAktData &&
    totalActBurnedForAktData &&
    dailyAktRemintedData &&
    totalAktRemintedData &&
    dailyNetAktBurnedData &&
    netAktBurnedData;

  return (
    <div className="mt-8">
      {hasData && (
        <>
          <Title className="mb-8 text-2xl font-semibold">BME Dashboard</Title>
          <BmeDashboard
            outstandingActData={outstandingActData}
            vaultAktData={vaultAktData}
            collateralRatioData={collateralRatioData}
            statusHistory={statusHistory ?? []}
            dailyAktBurnedForActData={dailyAktBurnedForActData}
            totalAktBurnedForActData={totalAktBurnedForActData}
            dailyActMintedData={dailyActMintedData}
            totalActMintedData={totalActMintedData}
            dailyActBurnedForAktData={dailyActBurnedForAktData}
            totalActBurnedForAktData={totalActBurnedForAktData}
            dailyAktRemintedData={dailyAktRemintedData}
            totalAktRemintedData={totalAktRemintedData}
            dailyNetAktBurnedData={dailyNetAktBurnedData}
            netAktBurnedData={netAktBurnedData}
          />
        </>
      )}

      {isLoading && !hasData && (
        <div className="flex items-center justify-center p-4">
          <Spinner size="large" />
        </div>
      )}
    </div>
  );
};
