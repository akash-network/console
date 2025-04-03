"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import Link from "next/link";

import { BlockRow } from "../../components/blockchain/BlockRow";
import { TransactionRow } from "../../components/blockchain/TransactionRow";
import { StatsCard } from "./StatsCard";

import { AKTAmount } from "@/components/AKTAmount";
import { AKTLabel } from "@/components/AKTLabel";
import { HumanReadableBytes } from "@/components/HumanReadableBytes";
import SearchBar from "@/components/SearchBar";
import { Title } from "@/components/Title";
import { USDCLabel } from "@/components/UsdLabel";
import { percIncrease, udenomToDenom } from "@/lib/mathHelpers";
import { bytesToShrink } from "@/lib/unitUtils";
import { UrlService } from "@/lib/urlUtils";
import type { DashboardData, MarketData } from "@/types";
import { ProviderSnapshotsUrlParam, SnapshotsUrlParam } from "@/types";

interface IDashboardProps {
  dashboardData: DashboardData;
  marketData: MarketData;
}

export const Dashboard: React.FunctionComponent<IDashboardProps> = ({ dashboardData }) => {
  const memoryDiff =
    dashboardData?.compare?.activeMemory !== undefined && dashboardData?.now?.activeMemory !== undefined
      ? bytesToShrink(dashboardData.now.activeMemory - dashboardData.compare.activeMemory)
      : bytesToShrink(0);

  const storageDiff =
    dashboardData?.compare?.activeStorage !== undefined && dashboardData?.now?.activeStorage !== undefined
      ? bytesToShrink(dashboardData.now.activeStorage - dashboardData.compare.activeStorage)
      : bytesToShrink(0);
  const capacityMemoryDiff =
    dashboardData?.networkCapacityStats?.now?.memory !== undefined && dashboardData?.networkCapacityStats?.compare?.memory !== undefined
      ? bytesToShrink(dashboardData.networkCapacityStats.now.memory - dashboardData.networkCapacityStats.compare.memory)
      : bytesToShrink(0);
  const capacityStorageDiff =
    dashboardData?.networkCapacityStats?.now?.storage !== undefined && dashboardData?.networkCapacityStats?.compare?.storage !== undefined
      ? bytesToShrink(dashboardData.networkCapacityStats.now.storage - dashboardData.networkCapacityStats.compare.storage)
      : bytesToShrink(0);

  return (
    <>
      {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          text="AKT Price"
          number={
            <FormattedNumber style="currency" currency="USD" value={marketData.price} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
          }
          diffPercent={marketData.priceChangePercentage24 / 100}
        />

        <StatsCard
          text="Market Cap"
          number={
            <FormattedNumber style="currency" currency="USD" value={marketData.marketCap} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
          }
        />
        <StatsCard
          text="Volume (24h)"
          number={
            <FormattedNumber style="currency" currency="USD" value={marketData.volume} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
          }
        />
        <StatsCard text="Rank" number={marketData.marketCapRank} />
      </div> */}

      {/* <Separator className="mb-8 mt-8" /> */}
      {dashboardData.now && dashboardData.compare && (
        <>
          <Title subTitle className="mb-4">
            Network Summary
          </Title>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dashboardData.now.dailyUUsdSpent !== undefined && dashboardData.compare.dailyUUsdSpent !== undefined && (
              <StatsCard
                number={
                  <FormattedNumber
                    value={udenomToDenom(dashboardData.now.dailyUUsdSpent)}
                    maximumFractionDigits={2}
                    style="currency"
                    notation="compact"
                    compactDisplay="short"
                    currency="USD"
                  />
                }
                text="USD spent (24h)"
                tooltip="Amount spent in the last 24h (USDC + AKT converted to USD)."
                graphPath={UrlService.graph(SnapshotsUrlParam.dailyUsdSpent)}
                diffNumber={udenomToDenom(dashboardData.now.dailyUUsdSpent - dashboardData.compare.dailyUUsdSpent)}
                diffPercent={percIncrease(dashboardData.compare.dailyUUsdSpent, dashboardData.now.dailyUUsdSpent)}
              />
            )}
            {dashboardData.now.totalUUsdSpent !== undefined && dashboardData.compare.totalUUsdSpent !== undefined && (
              <StatsCard
                number={
                  <FormattedNumber
                    value={udenomToDenom(dashboardData.now.totalUUsdSpent)}
                    maximumFractionDigits={2}
                    style="currency"
                    notation="compact"
                    compactDisplay="short"
                    currency="USD"
                  />
                }
                text="Total spent USD"
                tooltip="This is the total amount spent (USDC + AKT converted to USD) to rent computing power on the akash network since the beginning of the network. (March 2021)"
                graphPath={UrlService.graph(SnapshotsUrlParam.totalUSDSpent)}
                diffNumber={udenomToDenom(dashboardData.now.totalUUsdSpent - dashboardData.compare.totalUUsdSpent)}
                diffPercent={percIncrease(dashboardData.compare.totalUUsdSpent, dashboardData.now.totalUUsdSpent)}
              />
            )}
            {dashboardData.now.dailyLeaseCount !== undefined && dashboardData.compare.dailyLeaseCount !== undefined && (
              <StatsCard
                number={
                  <FormattedNumber
                    value={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount}
                    notation="compact"
                    compactDisplay="short"
                  />
                }
                text="New leases (24h)"
                tooltip="Last 24h"
                graphPath={UrlService.graph(SnapshotsUrlParam.dailyDeploymentCount)}
                diffNumber={dashboardData.now.dailyLeaseCount - dashboardData.compare.dailyLeaseCount}
                diffPercent={percIncrease(dashboardData.compare.dailyLeaseCount, dashboardData.now.dailyLeaseCount)}
              />
            )}

            {dashboardData.now.totalLeaseCount !== undefined && dashboardData.compare.totalLeaseCount !== undefined && (
              <StatsCard
                number={<FormattedNumber value={dashboardData.now.totalLeaseCount} notation="compact" compactDisplay="short" />}
                text="Total leases"
                tooltip="The total lease count consists of all deployments that were live at some point and that someone paid for. This includes deployments that were deployed for testing or that were meant to be only temporary."
                graphPath={UrlService.graph(SnapshotsUrlParam.allTimeDeploymentCount)}
                diffNumber={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount}
                diffPercent={percIncrease(dashboardData.compare.totalLeaseCount, dashboardData.now.totalLeaseCount)}
              />
            )}
          </div>

          <Separator className="mb-8 mt-8" />
          <Title subTitle className="mb-4">
            Resources leased
          </Title>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {dashboardData.now.activeLeaseCount !== undefined && dashboardData.compare.activeLeaseCount !== undefined && (
              <StatsCard
                number={<FormattedNumber value={dashboardData.now.activeLeaseCount} notation="compact" compactDisplay="short" maximumFractionDigits={2} />}
                text="Active leases"
                tooltip={
                  <>
                    <div>This is the number of leases currently active on the network. A deployment can be anything. </div>
                    <div>For example: a simple website to a blockchain node or a video game server.</div>
                  </>
                }
                graphPath={UrlService.graph(SnapshotsUrlParam.activeLeases)}
                diffNumber={dashboardData.now.activeLeaseCount - dashboardData.compare.activeLeaseCount}
                diffPercent={percIncrease(dashboardData.compare.activeLeaseCount, dashboardData.now.activeLeaseCount)}
              />
            )}

            {dashboardData.now.activeCPU !== undefined && dashboardData.compare.activeCPU !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber value={dashboardData.now.activeCPU / 1000} maximumFractionDigits={2} notation="compact" compactDisplay="short" />{" "}
                    <span className="text-sm">CPU</span>
                  </>
                }
                text="Compute"
                graphPath={UrlService.graph(SnapshotsUrlParam.compute)}
                diffNumber={(dashboardData.now.activeCPU - dashboardData.compare.activeCPU) / 1000}
                diffPercent={percIncrease(dashboardData.compare.activeCPU, dashboardData.now.activeCPU)}
              />
            )}

            {dashboardData.now.activeGPU !== undefined && dashboardData.compare.activeGPU !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber value={dashboardData.now.activeGPU} maximumFractionDigits={2} notation="compact" compactDisplay="short" />{" "}
                    <span className="text-sm">GPU</span>
                  </>
                }
                text="Graphics"
                graphPath={UrlService.graph(SnapshotsUrlParam.graphics)}
                diffNumber={dashboardData.now.activeGPU - dashboardData.compare.activeGPU}
                diffPercent={percIncrease(dashboardData.compare.activeGPU, dashboardData.now.activeGPU)}
              />
            )}

            {dashboardData.now.activeMemory !== undefined && dashboardData.compare.activeMemory !== undefined && (
              <StatsCard
                number={<HumanReadableBytes value={dashboardData.now.activeMemory} />}
                text="Memory"
                graphPath={UrlService.graph(SnapshotsUrlParam.memory)}
                diffNumberUnit={memoryDiff.unit}
                diffNumber={memoryDiff.value}
                diffPercent={percIncrease(dashboardData.compare.activeMemory, dashboardData.now.activeMemory)}
              />
            )}

            {dashboardData.now.activeStorage !== undefined && dashboardData.compare.activeStorage !== undefined && (
              <StatsCard
                number={<HumanReadableBytes value={dashboardData.now.activeStorage} />}
                text="Storage"
                graphPath={UrlService.graph(SnapshotsUrlParam.storage)}
                diffNumberUnit={storageDiff.unit}
                diffNumber={storageDiff.value}
                diffPercent={percIncrease(dashboardData.compare.activeStorage, dashboardData.now.activeStorage)}
              />
            )}
          </div>
        </>
      )}

      {dashboardData.networkCapacity && dashboardData.networkCapacity && (
        <>
          <Separator className="mb-8 mt-8" />
          <Title subTitle className="mb-4">
            Network Capacity
          </Title>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {dashboardData.networkCapacity.activeProviderCount !== undefined &&
              dashboardData.networkCapacityStats.now.count !== undefined &&
              dashboardData.networkCapacityStats.compare.count !== undefined && (
                <StatsCard
                  number={<FormattedNumber value={dashboardData.networkCapacity.activeProviderCount} notation="compact" compactDisplay="short" />}
                  text="Active providers"
                  graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.count)}
                  diffNumber={dashboardData.networkCapacityStats.now.count - dashboardData.networkCapacityStats.compare.count}
                  diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.count, dashboardData.networkCapacityStats.now.count)}
                  tooltip={
                    <>
                      <div>This is the number of providers currently active on the network.</div>
                    </>
                  }
                />
              )}

            {dashboardData.networkCapacity.totalCPU !== undefined &&
              dashboardData.networkCapacityStats.now.cpu !== undefined &&
              dashboardData.networkCapacityStats.compare.cpu !== undefined && (
                <StatsCard
                  number={
                    <>
                      <FormattedNumber
                        value={dashboardData.networkCapacity.totalCPU / 1000}
                        maximumFractionDigits={2}
                        notation="compact"
                        compactDisplay="short"
                      />{" "}
                      <span className="text-sm">CPU</span>
                    </>
                  }
                  text="Compute"
                  graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.cpu)}
                  diffNumber={(dashboardData.networkCapacityStats.now.cpu - dashboardData.networkCapacityStats.compare.cpu) / 1000}
                  diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.cpu, dashboardData.networkCapacityStats.now.cpu)}
                />
              )}
            {dashboardData.networkCapacity.totalGPU !== undefined &&
              dashboardData.networkCapacityStats.now.gpu !== undefined &&
              dashboardData.networkCapacityStats.compare.gpu !== undefined && (
                <StatsCard
                  number={
                    <>
                      <FormattedNumber value={dashboardData.networkCapacity.totalGPU} maximumFractionDigits={2} notation="compact" compactDisplay="short" />{" "}
                      <span className="text-sm">GPU</span>
                    </>
                  }
                  text="Graphics"
                  graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.gpu)}
                  diffNumber={dashboardData.networkCapacityStats.now.gpu - dashboardData.networkCapacityStats.compare.gpu}
                  diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.gpu, dashboardData.networkCapacityStats.now.gpu)}
                />
              )}

            {dashboardData.networkCapacity.totalMemory !== undefined &&
              dashboardData.networkCapacityStats.now.memory !== undefined &&
              dashboardData.networkCapacityStats.compare.memory !== undefined && (
                <StatsCard
                  number={<HumanReadableBytes value={dashboardData.networkCapacity.totalMemory} />}
                  text="Memory"
                  diffNumberUnit={capacityMemoryDiff.unit}
                  diffNumber={capacityMemoryDiff.value}
                  diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.memory, dashboardData.networkCapacityStats.now.memory)}
                  graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.memory)}
                />
              )}

            {dashboardData.networkCapacity.totalStorage !== undefined &&
              dashboardData.networkCapacityStats.now.storage !== undefined &&
              dashboardData.networkCapacityStats.compare.storage !== undefined && (
                <StatsCard
                  number={<HumanReadableBytes value={dashboardData.networkCapacity.totalStorage} />}
                  text="Storage"
                  graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.storage)}
                  diffNumberUnit={capacityStorageDiff.unit}
                  diffNumber={capacityStorageDiff.value}
                  diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.storage, dashboardData.networkCapacityStats.now.storage)}
                />
              )}
          </div>
        </>
      )}
      {dashboardData.now && dashboardData.compare && (
        <>
          <Separator className="mb-8 mt-8" />
          <Title subTitle className="mb-4">
            Spent Assets
          </Title>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dashboardData.now.dailyUAktSpent !== undefined && dashboardData.compare.dailyUAktSpent !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber
                      value={udenomToDenom(dashboardData.now.dailyUAktSpent)}
                      maximumFractionDigits={2}
                      notation="compact"
                      compactDisplay="short"
                    />
                    <AKTLabel />
                  </>
                }
                text="AKT spent (24h)"
                tooltip="Last 24h"
                graphPath={UrlService.graph(SnapshotsUrlParam.dailyAktSpent)}
                diffNumber={udenomToDenom(dashboardData.now.dailyUAktSpent - dashboardData.compare.dailyUAktSpent)}
                diffPercent={percIncrease(dashboardData.compare.dailyUAktSpent, dashboardData.now.dailyUAktSpent)}
              />
            )}

            {dashboardData.now.totalUAktSpent !== undefined && dashboardData.compare.totalUAktSpent !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber
                      value={udenomToDenom(dashboardData.now.totalUAktSpent)}
                      maximumFractionDigits={2}
                      notation="compact"
                      compactDisplay="short"
                    />
                    <AKTLabel />
                  </>
                }
                text="Total spent AKT"
                tooltip="This is the total amount of akt spent to rent computing power on the akash network since the beginning of the network. (March 2021)"
                graphPath={UrlService.graph(SnapshotsUrlParam.totalAKTSpent)}
                diffNumber={udenomToDenom(dashboardData.now.totalUAktSpent - dashboardData.compare.totalUAktSpent)}
                diffPercent={percIncrease(dashboardData.compare.totalUAktSpent, dashboardData.now.totalUAktSpent)}
              />
            )}

            {dashboardData.now.dailyUUsdcSpent !== undefined && dashboardData.compare.dailyUUsdcSpent !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber
                      value={udenomToDenom(dashboardData.now.dailyUUsdcSpent)}
                      maximumFractionDigits={2}
                      notation="compact"
                      compactDisplay="short"
                    />
                    <USDCLabel />
                  </>
                }
                text="USDC spent (24h)"
                tooltip="Last 24h"
                graphPath={UrlService.graph(SnapshotsUrlParam.dailyUsdcSpent)}
                diffNumber={udenomToDenom(dashboardData.now.dailyUUsdcSpent - dashboardData.compare.dailyUUsdcSpent)}
                diffPercent={percIncrease(dashboardData.compare.dailyUUsdcSpent, dashboardData.now.dailyUUsdcSpent)}
              />
            )}

            {dashboardData.now.totalUUsdcSpent !== undefined && dashboardData.compare.totalUUsdcSpent !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber
                      value={udenomToDenom(dashboardData.now.totalUUsdcSpent)}
                      maximumFractionDigits={2}
                      notation="compact"
                      compactDisplay="short"
                    />
                    <USDCLabel />
                  </>
                }
                text="Total spent USDC"
                tooltip="This is the total amount of usdc spent to rent computing power on the akash network since the Mainnet 6 upgrade that added usdc support. (August 2023)"
                graphPath={UrlService.graph(SnapshotsUrlParam.totalUSDCSpent)}
                diffNumber={udenomToDenom(dashboardData.now.totalUUsdcSpent - dashboardData.compare.totalUUsdcSpent)}
                diffPercent={percIncrease(dashboardData.compare.totalUUsdcSpent, dashboardData.now.totalUUsdcSpent)}
              />
            )}
          </div>
        </>
      )}
      {dashboardData.chainStats && (
        <>
          <Separator className="mb-8 mt-8" />
          <Title subTitle className="mb-4">
            Blockchain
          </Title>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboardData.chainStats.height !== undefined && <StatsCard number={<FormattedNumber value={dashboardData.chainStats.height} />} text="Height" />}

            {dashboardData.chainStats.transactionCount !== undefined && (
              <StatsCard number={<FormattedNumber value={dashboardData.chainStats.transactionCount} />} text="Transactions" />
            )}

            {dashboardData.chainStats.communityPool !== undefined && (
              <StatsCard number={<AKTAmount uakt={dashboardData.chainStats.communityPool} digits={0} showAKTLabel showUSD />} text="Community pool" />
            )}

            {dashboardData.chainStats.bondedTokens !== undefined && dashboardData.chainStats.totalSupply !== undefined && (
              <StatsCard
                number={
                  <>
                    <FormattedNumber value={udenomToDenom(dashboardData.chainStats.bondedTokens)} notation="compact" maximumFractionDigits={2} /> /{" "}
                    <FormattedNumber value={udenomToDenom(dashboardData.chainStats.totalSupply)} notation="compact" maximumFractionDigits={2} />
                    <span className="ml-4 text-sm text-muted-foreground">
                      <FormattedNumber
                        value={udenomToDenom(dashboardData.chainStats.bondedTokens) / udenomToDenom(dashboardData.chainStats.totalSupply)}
                        style="percent"
                        maximumFractionDigits={2}
                      />
                    </span>
                  </>
                }
                text="Bonded tokens"
              />
            )}

            {dashboardData.chainStats.inflation !== undefined && (
              <StatsCard
                number={<FormattedNumber value={dashboardData.chainStats.inflation} style="percent" minimumFractionDigits={2} maximumFractionDigits={2} />}
                text="Inflation"
              />
            )}

            {dashboardData.chainStats.stakingAPR !== undefined && (
              <StatsCard
                number={<FormattedNumber value={dashboardData.chainStats.stakingAPR} style="percent" minimumFractionDigits={2} maximumFractionDigits={2} />}
                text="Staking APR"
              />
            )}
          </div>
        </>
      )}

      <div className="pb-4 pt-12">
        <SearchBar />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex w-full flex-col justify-between">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 pl-4 pr-4">
            <CardTitle className="text-lg font-medium">Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4 text-center">Height</TableHead>
                  <TableHead className="w-1/3 text-center">Proposer</TableHead>
                  <TableHead className="w-1/5 text-center">Txs</TableHead>
                  <TableHead className="w-1/5 text-center">Time</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>{dashboardData.latestBlocks && dashboardData.latestBlocks.map(block => <BlockRow key={block.height} block={block} />)}</TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <Link href={UrlService.blocks()} className="w-full">
              <Button variant="outline" className="w-full">
                Load More
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 pl-4 pr-4">
            <CardTitle className="text-lg font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tx Hash</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Height</TableHead>
                  <TableHead className="text-center">Time</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {dashboardData.latestTransactions &&
                  dashboardData.latestTransactions.map(tx => <TransactionRow key={tx.hash} transaction={tx} isSimple blockHeight={tx.height} />)}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <Link href={UrlService.transactions()} className="w-full">
              <Button variant="outline" className="w-full">
                Load More
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};
