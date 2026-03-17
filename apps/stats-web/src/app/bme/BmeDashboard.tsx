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
import type { BmeDashboardData } from "@/types";
import { BmeSnapshotsUrlParam } from "@/types";

interface BmeDashboardProps {
  dashboardData: BmeDashboardData;
  statusHistory: BmeStatusHistoryResponse;
}

export const BmeDashboard: React.FunctionComponent<BmeDashboardProps> = ({ dashboardData, statusHistory }) => {
  const latestStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1] : null;

  return (
    <>
      <Title subTitle className="mb-4">
        Summary
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={<FormattedNumber value={udenomToDenom(dashboardData.outstandingAct)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />}
          text="Outstanding ACT"
          tooltip="Total ACT currently in circulation"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.outstandingAct)}
        />

        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dashboardData.vaultAkt)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <span className="ml-1 text-sm">AKT</span>
            </>
          }
          text="Vault AKT Balance"
          tooltip="Current AKT balance held in the BME vault"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.vaultAkt)}
        />

        <StatsCard
          number={<FormattedNumber value={dashboardData.collateralRatio} maximumFractionDigits={4} />}
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
              <FormattedNumber value={udenomToDenom(dashboardData.dailyAktBurnedForAct)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.totalAktBurnedForAct)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.dailyActMinted)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.totalActMinted)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.dailyActBurnedForAkt)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.totalActBurnedForAkt)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.dailyAktReminted)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.totalAktReminted)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.dailyNetAktBurned)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
              <FormattedNumber value={udenomToDenom(dashboardData.netAktBurned)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
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
