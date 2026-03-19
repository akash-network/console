"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Separator } from "@akashnetwork/ui/components";

import { StatsCard } from "../(home)/StatsCard";
import { BmeStatusBadge } from "./BmeStatusBadge";

import { Title } from "@/components/Title";
import { usePricing } from "@/context/PricingProvider";
import { percIncrease, udenomToDenom } from "@/lib/mathHelpers";
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
  const { now, compare } = dashboardData;
  const { aktToUSD, price } = usePricing();

  const renderAkt = (uAmount: number) => (
    <>
      <FormattedNumber value={udenomToDenom(uAmount)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
      <span className="ml-1 text-sm">AKT</span>
    </>
  );

  const renderAktUsd = (uAmount: number) =>
    price > 0 ? (
      <div className="text-sm font-normal text-muted-foreground">
        <FormattedNumber value={aktToUSD(udenomToDenom(uAmount))} style="currency" currency="USD" notation="compact" compactDisplay="short" />
      </div>
    ) : null;

  const subNumberSpacer = <div className="text-sm">&nbsp;</div>;

  const renderAct = (uAmount: number) => (
    <>
      <FormattedNumber value={udenomToDenom(uAmount)} style="currency" currency="USD" maximumFractionDigits={2} notation="compact" compactDisplay="short" />
      <span className="ml-1 text-sm">ACT</span>
    </>
  );

  return (
    <>
      <Title subTitle className="mb-4">
        Summary
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={renderAct(now.outstandingAct)}
          subNumber={subNumberSpacer}
          text="Outstanding ACT"
          tooltip="Total ACT currently in circulation"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.outstandingAct)}
          diffPercent={percIncrease(compare.outstandingAct, now.outstandingAct)}
        />

        <StatsCard
          number={renderAkt(now.vaultAkt)}
          subNumber={renderAktUsd(now.vaultAkt)}
          text="Vault AKT Balance"
          tooltip="Current AKT balance held in the BME vault"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.vaultAkt)}
          diffPercent={percIncrease(compare.vaultAkt, now.vaultAkt)}
        />

        <StatsCard
          number={renderAkt(now.dailyNetAktBurned)}
          subNumber={renderAktUsd(now.dailyNetAktBurned)}
          text="Net AKT Burned (24h)"
          tooltip="Net AKT burned per day (burned minus reminted)"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyNetAktBurned)}
          diffPercent={percIncrease(compare.dailyNetAktBurned, now.dailyNetAktBurned)}
        />
        <StatsCard
          number={renderAkt(now.netAktBurned)}
          subNumber={renderAktUsd(now.netAktBurned)}
          text="Net AKT Burned"
          tooltip="Cumulative net AKT burned (burned minus reminted)"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.netAktBurned)}
          diffPercent={percIncrease(compare.netAktBurned, now.netAktBurned)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        AKT Burn &amp; ACT Mint
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={renderAkt(now.dailyAktBurnedForAct)}
          subNumber={renderAktUsd(now.dailyAktBurnedForAct)}
          text="AKT Burned for ACT (24h)"
          tooltip="Daily AKT burned to mint ACT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyAktBurnedForAct)}
          diffPercent={percIncrease(compare.dailyAktBurnedForAct, now.dailyAktBurnedForAct)}
        />
        <StatsCard
          number={renderAkt(now.totalAktBurnedForAct)}
          subNumber={renderAktUsd(now.totalAktBurnedForAct)}
          text="Total AKT Burned for ACT"
          tooltip="Cumulative AKT burned to mint ACT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalAktBurnedForAct)}
          diffPercent={percIncrease(compare.totalAktBurnedForAct, now.totalAktBurnedForAct)}
        />
        <StatsCard
          number={renderAct(now.dailyActMinted)}
          subNumber={subNumberSpacer}
          text="ACT Minted (24h)"
          tooltip="Daily ACT minted"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyActMinted)}
          diffPercent={percIncrease(compare.dailyActMinted, now.dailyActMinted)}
        />
        <StatsCard
          number={renderAct(now.totalActMinted)}
          subNumber={subNumberSpacer}
          text="Total ACT Minted"
          tooltip="Cumulative ACT minted since genesis"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalActMinted)}
          diffPercent={percIncrease(compare.totalActMinted, now.totalActMinted)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        ACT Burn &amp; AKT Remint
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={renderAct(now.dailyActBurnedForAkt)}
          subNumber={subNumberSpacer}
          text="ACT Burned for AKT (24h)"
          tooltip="Daily ACT burned to remint AKT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyActBurnedForAkt)}
          diffPercent={percIncrease(compare.dailyActBurnedForAkt, now.dailyActBurnedForAkt)}
        />
        <StatsCard
          number={renderAct(now.totalActBurnedForAkt)}
          subNumber={subNumberSpacer}
          text="Total ACT Burned for AKT"
          tooltip="Cumulative ACT burned to remint AKT"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalActBurnedForAkt)}
          diffPercent={percIncrease(compare.totalActBurnedForAkt, now.totalActBurnedForAkt)}
        />
        <StatsCard
          number={renderAkt(now.dailyAktReminted)}
          subNumber={renderAktUsd(now.dailyAktReminted)}
          text="AKT Reminted (24h)"
          tooltip="Daily AKT reminted from ACT burns"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.dailyAktReminted)}
          diffPercent={percIncrease(compare.dailyAktReminted, now.dailyAktReminted)}
        />
        <StatsCard
          number={renderAkt(now.totalAktReminted)}
          subNumber={renderAktUsd(now.totalAktReminted)}
          text="Total AKT Reminted"
          tooltip="Cumulative AKT reminted from ACT burns"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.totalAktReminted)}
          diffPercent={percIncrease(compare.totalAktReminted, now.totalAktReminted)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Collateral &amp; Circuit Breaker
      </Title>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={<FormattedNumber value={now.collateralRatio} maximumFractionDigits={4} />}
          text="Collateral Ratio"
          tooltip="Ratio of vault value to outstanding ACT — a key health metric"
          graphPath={UrlService.bmeGraph(BmeSnapshotsUrlParam.collateralRatio)}
          diffPercent={percIncrease(compare.collateralRatio, now.collateralRatio)}
        />
        <StatsCard
          number={<BmeStatusBadge status={latestStatus?.newStatus ?? "unknown"} />}
          text="Circuit Breaker Status"
          tooltip="Current mint status derived from the latest circuit breaker event"
        />
      </div>
    </>
  );
};
