"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Separator } from "@akashnetwork/ui/components";

import { StatsCard } from "../(home)/StatsCard";
import { BmeStatusBadge } from "./BmeStatusBadge";
import { BmeStatusTimeline } from "./BmeStatusTimeline";

import { Title } from "@/components/Title";
import { udenomToDenom } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";
import type { BmeStatusHistoryResponse } from "@/queries";
import type { GraphResponse } from "@/types";
import { BmeSnapshotsUrlParam } from "@/types";

interface BmeDashboardProps {
  outstandingActData: GraphResponse;
  vaultAktData: GraphResponse;
  collateralRatioData: GraphResponse;
  statusHistory: BmeStatusHistoryResponse;
  dailyAktBurnedForActData: GraphResponse;
  totalAktBurnedForActData: GraphResponse;
  dailyActMintedData: GraphResponse;
  totalActMintedData: GraphResponse;
  dailyActBurnedForAktData: GraphResponse;
  totalActBurnedForAktData: GraphResponse;
  dailyAktRemintedData: GraphResponse;
  totalAktRemintedData: GraphResponse;
  dailyNetAktBurnedData: GraphResponse;
  netAktBurnedData: GraphResponse;
}

export const BmeDashboard: React.FunctionComponent<BmeDashboardProps> = ({
  outstandingActData,
  vaultAktData,
  collateralRatioData,
  statusHistory,
  dailyAktBurnedForActData,
  totalAktBurnedForActData,
  dailyActMintedData,
  totalActMintedData,
  dailyActBurnedForAktData,
  totalActBurnedForAktData,
  dailyAktRemintedData,
  totalAktRemintedData,
  dailyNetAktBurnedData,
  netAktBurnedData
}) => {
  const latestStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1] : null;

  return (
    <>
      <Title subTitle className="mb-4">
        Summary
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <FormattedNumber value={udenomToDenom(outstandingActData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
          }
          text="Outstanding ACT"
          tooltip="Total ACT currently in circulation"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.outstandingAct)}
        />

        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(vaultAktData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Vault AKT Balance"
          tooltip="Current AKT balance held in the BME vault"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.vaultAkt)}
        />

        <StatsCard
          number={<FormattedNumber value={collateralRatioData.currentValue} maximumFractionDigits={4} />}
          text="Collateral Ratio"
          tooltip="Ratio of vault value to outstanding ACT — a key health metric"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.collateralRatio)}
        />

        <StatsCard
          number={<BmeStatusBadge status={latestStatus?.newStatus ?? "unknown"} />}
          text="Circuit Breaker Status"
          tooltip="Current mint status derived from the latest circuit breaker event"
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        AKT Burn &amp; ACT Mint
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <>
              <FormattedNumber
                value={udenomToDenom(dailyAktBurnedForActData.currentValue)}
                maximumFractionDigits={2}
                notation="compact"
                compactDisplay="short"
              />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="AKT Burned for ACT"
          tooltip="Daily AKT burned to mint ACT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyAktBurnedForAct)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber
                value={udenomToDenom(totalAktBurnedForActData.currentValue)}
                maximumFractionDigits={2}
                notation="compact"
                compactDisplay="short"
              />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Total AKT Burned for ACT"
          tooltip="Cumulative AKT burned to mint ACT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalAktBurnedForAct)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dailyActMintedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">ACT</span>
            </>
          }
          text="ACT Minted"
          tooltip="Daily ACT minted"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyActMinted)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(totalActMintedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">ACT</span>
            </>
          }
          text="Total ACT Minted"
          tooltip="Cumulative ACT minted since genesis"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalActMinted)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        ACT Burn &amp; AKT Remint
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <>
              <FormattedNumber
                value={udenomToDenom(dailyActBurnedForAktData.currentValue)}
                maximumFractionDigits={2}
                notation="compact"
                compactDisplay="short"
              />
              <span className="ml-1 text-sm">ACT</span>
            </>
          }
          text="ACT Burned for AKT"
          tooltip="Daily ACT burned to remint AKT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyActBurnedForAkt)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber
                value={udenomToDenom(totalActBurnedForAktData.currentValue)}
                maximumFractionDigits={2}
                notation="compact"
                compactDisplay="short"
              />
              <span className="ml-1 text-sm">ACT</span>
            </>
          }
          text="Total ACT Burned for AKT"
          tooltip="Cumulative ACT burned to remint AKT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalActBurnedForAkt)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dailyAktRemintedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="AKT Reminted"
          tooltip="Daily AKT reminted from ACT burns"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyAktReminted)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(totalAktRemintedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Total AKT Reminted"
          tooltip="Cumulative AKT reminted from ACT burns"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalAktReminted)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Net Burn
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dailyNetAktBurnedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Daily Net AKT Burned"
          tooltip="Net AKT burned per day (burned minus reminted)"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyNetAktBurned)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(netAktBurnedData.currentValue)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Net AKT Burned"
          tooltip="Cumulative net AKT burned (burned minus reminted)"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.netAktBurned)}
        />
      </div>

      {statusHistory.length > 0 && (
        <>
          <Separator className="mb-8 mt-8" />
          <Title subTitle className="mb-4">
            Circuit Breaker History
          </Title>
          <BmeStatusTimeline statusHistory={statusHistory} />
        </>
      )}
    </>
  );
};
