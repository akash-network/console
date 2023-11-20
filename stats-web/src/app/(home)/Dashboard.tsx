import React from "react";
import { FormattedNumber } from "react-intl";
import { StatsCard } from "./StatsCard";
import { DashboardData, ProviderSnapshotsUrlParam, SnapshotsUrlParam } from "@/types";
import { useMarketData } from "@/queries";
import { bytesToShrink } from "@/lib/unitUtils";
import { FormattedDecimalCurrency } from "@/components/FormattedDecimalCurrency";
import { Title } from "@/components/Title";
import { Separator } from "@/components/ui/separator";
import { percIncrease, udenomToDenom } from "@/lib/mathHelpers";
import { USDCLabel } from "@/components/UsdLabel";
import { UrlService } from "@/lib/urlUtils";
import { HumanReadableBytes } from "@/components/HumanReadableBytes";

interface IDashboardProps {
  dashboardData: DashboardData;
}

// const useStyles = makeStyles()(theme => ({
//   link: {
//     textDecoration: "underline"
//   },
//   liveChip: {
//     "&&": {
//       fontWeight: "normal",
//       marginLeft: "1rem",
//       fontSize: ".8rem",
//       height: "20px"
//     }
//   },
//   priceDataContainer: {
//     padding: "1rem",
//     marginBottom: "1.5rem",
//     borderRadius: ".5rem",
//     display: "flex",
//     alignItems: "center",
//     fontSize: "1rem",
//     [theme.breakpoints.down("sm")]: {
//       flexDirection: "column",
//       alignItems: "baseline"
//     }
//   },
//   priceData: {
//     marginLeft: "1rem",
//     flexGrow: 1,
//     display: "flex",
//     alignItems: "center",
//     [theme.breakpoints.down("sm")]: {
//       marginLeft: "0"
//     }
//   },
//   priceDataValue: {
//     fontWeight: "bold",
//     display: "flex",
//     alignItems: "center",
//     marginLeft: ".5rem"
//   },
//   loadMoreButton: {
//     borderColor: theme.palette.mode === "dark" ? theme.palette.grey[600] : theme.palette.grey[400],
//     textTransform: "initial"
//   }
// }));

export const Dashboard: React.FunctionComponent<IDashboardProps> = ({ dashboardData }) => {
  const { data: marketData } = useMarketData();
  const memoryDiff = bytesToShrink(dashboardData.now.activeMemory - dashboardData.compare.activeMemory);
  const storageDiff = bytesToShrink(dashboardData.now.activeStorage - dashboardData.compare.activeStorage);
  const capacityMemoryDiff = bytesToShrink(dashboardData.networkCapacityStats.now.memory - dashboardData.networkCapacityStats.compare.memory);
  const capacityStorageDiff = bytesToShrink(dashboardData.networkCapacityStats.now.storage - dashboardData.networkCapacityStats.compare.storage);

  return (
    <>
      {marketData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            text="AKT Price"
            number={<FormattedDecimalCurrency style="currency" currency="USD" value={marketData.price} precision={2} />}
            diffPercent={marketData.priceChangePercentage24 / 100}
          />

          <StatsCard text="Market Cap" number={<FormattedDecimalCurrency style="currency" currency="USD" value={marketData.marketCap} precision={0} />} />
          <StatsCard text="Volume (24h)" number={<FormattedDecimalCurrency style="currency" currency="USD" value={marketData.volume} precision={0} />} />
          <StatsCard text="Rank" number={marketData.marketCapRank} />
        </div>
      )}

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Network Summary
      </Title>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <>
              <span>
                <FormattedNumber
                  value={udenomToDenom(dashboardData.now.dailyUUsdSpent)}
                  maximumFractionDigits={2}
                  style="currency"
                  notation="compact"
                  compactDisplay="short"
                  currency="USD"
                />
              </span>
            </>
          }
          text="USD spent (24h)"
          tooltip="Amount spent in the last 24h (USDC + AKT converted to USD)."
          graphPath={UrlService.graph(SnapshotsUrlParam.dailyUsdSpent)}
          diffNumber={udenomToDenom(dashboardData.now.dailyUUsdSpent - dashboardData.compare.dailyUUsdSpent)}
          diffPercent={percIncrease(dashboardData.compare.dailyUUsdSpent, dashboardData.now.dailyUUsdSpent)}
        />

        <StatsCard
          number={
            <>
              <FormattedNumber
                value={udenomToDenom(dashboardData.now.totalUUsdSpent)}
                maximumFractionDigits={2}
                style="currency"
                notation="compact"
                compactDisplay="short"
                currency="USD"
              />
            </>
          }
          text="Total spent USD"
          tooltip="This is the total amount spent (USDC + AKT converted to USD) to rent computing power on the akash network since the beginning of the network. (March 2021)"
          graphPath={UrlService.graph(SnapshotsUrlParam.totalUSDSpent)}
          diffNumber={udenomToDenom(dashboardData.now.totalUUsdSpent - dashboardData.compare.totalUUsdSpent)}
          diffPercent={percIncrease(dashboardData.compare.totalUUsdSpent, dashboardData.now.totalUUsdSpent)}
        />

        <StatsCard
          number={
            <FormattedNumber value={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount} notation="compact" compactDisplay="short" />
          }
          text="New leases (24h)"
          tooltip="Last 24h"
          graphPath={UrlService.graph(SnapshotsUrlParam.dailyDeploymentCount)}
          diffNumber={dashboardData.now.dailyLeaseCount - dashboardData.compare.dailyLeaseCount}
          diffPercent={percIncrease(dashboardData.compare.dailyLeaseCount, dashboardData.now.dailyLeaseCount)}
        />

        <StatsCard
          number={<FormattedNumber value={dashboardData.now.totalLeaseCount} notation="compact" compactDisplay="short" />}
          text="Total leases"
          tooltip="The total lease count consists of all deployments that were live at some point and that someone paid for. This includes deployments that were deployed for testing or that were meant to be only temporary."
          graphPath={UrlService.graph(SnapshotsUrlParam.allTimeDeploymentCount)}
          diffNumber={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount}
          diffPercent={percIncrease(dashboardData.compare.totalLeaseCount, dashboardData.now.totalLeaseCount)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Spent Assets
      </Title>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          number={
            <>
              <span>
                <FormattedNumber value={udenomToDenom(dashboardData.now.dailyUAktSpent)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              </span>
              <AKTLabel />
            </>
          }
          text="AKT spent (24h)"
          tooltip="Last 24h"
          graphPath={UrlService.graph(SnapshotsUrlParam.dailyAktSpent)}
          diffNumber={udenomToDenom(dashboardData.now.dailyUAktSpent - dashboardData.compare.dailyUAktSpent)}
          diffPercent={percIncrease(dashboardData.compare.dailyUAktSpent, dashboardData.now.dailyUAktSpent)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dashboardData.now.totalUAktSpent)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />{" "}
              <AKTLabel />
            </>
          }
          text="Total spent AKT"
          tooltip="This is the total amount of akt spent to rent computing power on the akash network since the beginning of the network. (March 2021)"
          graphPath={UrlService.graph(SnapshotsUrlParam.totalAKTSpent)}
          diffNumber={udenomToDenom(dashboardData.now.totalUAktSpent - dashboardData.compare.totalUAktSpent)}
          diffPercent={percIncrease(dashboardData.compare.totalUAktSpent, dashboardData.now.totalUAktSpent)}
        />

        <StatsCard
          number={
            <>
              <span>
                <FormattedNumber value={udenomToDenom(dashboardData.now.dailyUUsdcSpent)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              </span>
              <USDCLabel />
            </>
          }
          text="USDC spent (24h)"
          tooltip="Last 24h"
          graphPath={UrlService.graph(SnapshotsUrlParam.dailyUsdcSpent)}
          diffNumber={udenomToDenom(dashboardData.now.dailyUUsdcSpent - dashboardData.compare.dailyUUsdcSpent)}
          diffPercent={percIncrease(dashboardData.compare.dailyUUsdcSpent, dashboardData.now.dailyUUsdcSpent)}
        />

        <StatsCard
          number={
            <>
              <FormattedNumber value={udenomToDenom(dashboardData.now.totalUUsdcSpent)} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
              <USDCLabel />
            </>
          }
          text="Total spent USDC"
          tooltip="This is the total amount of usdc spent to rent computing power on the akash network since the Mainnet 6 upgrade that added usdc support. (August 2023)"
          graphPath={UrlService.graph(SnapshotsUrlParam.totalUSDCSpent)}
          diffNumber={udenomToDenom(dashboardData.now.totalUUsdcSpent - dashboardData.compare.totalUUsdcSpent)}
          diffPercent={percIncrease(dashboardData.compare.totalUUsdcSpent, dashboardData.now.totalUUsdcSpent)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Resources leased
      </Title>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          number={<FormattedNumber value={dashboardData.now.activeLeaseCount} notation="compact" compactDisplay="short" />}
          text="Active leases"
          tooltip={
            <>
              <div>This is the number of leases currently active on the network. A deployment can be anything. </div>
              <div>For example: a simple website to a blockchain node or a video game server.</div>
            </>
          }
          graphPath={UrlService.graph(SnapshotsUrlParam.activeDeployment)}
          diffNumber={dashboardData.now.activeLeaseCount - dashboardData.compare.activeLeaseCount}
          diffPercent={percIncrease(dashboardData.compare.activeLeaseCount, dashboardData.now.activeLeaseCount)}
        />

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

        <StatsCard
          number={<HumanReadableBytes value={dashboardData.now.activeMemory} />}
          text="Memory"
          graphPath={UrlService.graph(SnapshotsUrlParam.memory)}
          diffNumberUnit={memoryDiff.unit}
          diffNumber={memoryDiff.value}
          diffPercent={percIncrease(dashboardData.compare.activeMemory, dashboardData.now.activeMemory)}
        />

        <StatsCard
          number={<HumanReadableBytes value={dashboardData.now.activeStorage} />}
          text="Storage"
          graphPath={UrlService.graph(SnapshotsUrlParam.storage)}
          diffNumberUnit={storageDiff.unit}
          diffNumber={storageDiff.value}
          diffPercent={percIncrease(dashboardData.compare.activeStorage, dashboardData.now.activeStorage)}
        />
      </div>

      <Separator className="mb-8 mt-8" />
      <Title subTitle className="mb-4">
        Network Capacity
      </Title>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

        <StatsCard
          number={
            <>
              <FormattedNumber value={dashboardData.networkCapacity.totalCPU / 1000} maximumFractionDigits={0} notation="compact" compactDisplay="short" />{" "}
              <span className="text-sm">CPU</span>
            </>
          }
          text="Compute"
          graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.cpu)}
          diffNumber={(dashboardData.networkCapacityStats.now.cpu - dashboardData.networkCapacityStats.compare.cpu) / 1000}
          diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.cpu, dashboardData.networkCapacityStats.now.cpu)}
        />
        <StatsCard
          number={
            <>
              <FormattedNumber value={dashboardData.networkCapacity.totalGPU} maximumFractionDigits={0} notation="compact" compactDisplay="short" />{" "}
              <span className="text-sm">GPU</span>
            </>
          }
          text="Graphics"
          graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.gpu)}
          diffNumber={dashboardData.networkCapacityStats.now.gpu - dashboardData.networkCapacityStats.compare.gpu}
          diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.gpu, dashboardData.networkCapacityStats.now.gpu)}
        />

        <StatsCard
          number={<HumanReadableBytes value={dashboardData.networkCapacity.totalMemory} />}
          text="Memory"
          diffNumberUnit={capacityMemoryDiff.unit}
          diffNumber={capacityMemoryDiff.value}
          diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.memory, dashboardData.networkCapacityStats.now.memory)}
          graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.memory)}
        />

        <StatsCard
          number={<HumanReadableBytes value={dashboardData.networkCapacity.totalStorage} />}
          text="Storage"
          graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.storage)}
          diffNumberUnit={capacityStorageDiff.unit}
          diffNumber={capacityStorageDiff.value}
          diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.storage, dashboardData.networkCapacityStats.now.storage)}
        />
      </div>

      {/* <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Title value="Blockchain" subTitle sx={{ textAlign: { sm: "center" } }} />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard number={<FormattedNumber value={dashboardData.chainStats.height} />} text="Height" />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard number={<FormattedNumber value={dashboardData.chainStats.transactionCount} />} text="Transactions" />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard
            number={
              <>
                <FormattedNumber
                  value={udenomToDenom(dashboardData.chainStats.communityPool, 6)}
                  notation="compact"
                  minimumFractionDigits={2}
                  maximumFractionDigits={2}
                />
                <AKTLabel />
              </>
            }
            text="Community pool"
          />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={udenomToDenom(dashboardData.chainStats.bondedTokens)} notation="compact" maximumFractionDigits={2} /> /{" "}
                <FormattedNumber value={udenomToDenom(dashboardData.chainStats.totalSupply)} notation="compact" maximumFractionDigits={2} />
                <Box component="span" sx={{ marginLeft: ".5rem", fontSize: ".85rem", color: theme.palette.grey[600] }}>
                  <FormattedNumber
                    value={udenomToDenom(dashboardData.chainStats.bondedTokens) / udenomToDenom(dashboardData.chainStats.totalSupply)}
                    style="percent"
                    maximumFractionDigits={2}
                  />
                </Box>
              </>
            }
            text="Bonded tokens"
          />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.chainStats.inflation} style="percent" minimumFractionDigits={2} maximumFractionDigits={2} />}
            text="Inflation"
          />
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.chainStats.stakingAPR} style="percent" minimumFractionDigits={2} maximumFractionDigits={2} />}
            text="Staking APR"
          />
        </Grid>
      </Grid> */}

      {/* <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Paper sx={{ padding: "1rem", borderRadius: ".5rem", height: "100%" }} elevation={2}>
            <Title value="Blocks" subTitle sx={{ mb: "1rem", border: "0 !important" }} />

            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <CustomTableHeader>
                  <TableRow>
                    <TableCell width="10%">Height</TableCell>
                    <TableCell align="center" width="45%">
                      Proposer
                    </TableCell>
                    <TableCell align="center" width="20%">
                      Txs
                    </TableCell>
                    <TableCell align="center" width="25%">
                      Time
                    </TableCell>
                  </TableRow>
                </CustomTableHeader>

                <TableBody>
                  {dashboardData.latestBlocks.map(block => (
                    <BlockRow key={block.height} block={block} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button component={Link} href={UrlService.blocks()} variant="outlined" color="inherit" className={classes.loadMoreButton}>
              Load More
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Paper sx={{ padding: "1rem", borderRadius: ".5rem", height: "100%" }} elevation={2}>
            <Title value="Transactions" subTitle sx={{ mb: "1rem", border: "0 !important" }} />

            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <CustomTableHeader>
                  <TableRow>
                    <TableCell width="35%">Tx Hash</TableCell>
                    <TableCell align="center" width="35%">
                      Type
                    </TableCell>
                    <TableCell align="center" width="15%">
                      Height
                    </TableCell>
                    <TableCell align="center" width="15%">
                      Time
                    </TableCell>
                  </TableRow>
                </CustomTableHeader>

                <TableBody>
                  {dashboardData.latestTransactions.map(tx => (
                    <TransactionRow key={tx.hash} transaction={tx} isSimple blockHeight={tx.height} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button component={Link} href={UrlService.transactions()} variant="outlined" color="inherit" className={classes.loadMoreButton}>
              Load More
            </Button>
          </Paper>
        </Grid>
      </Grid> */}
    </>
  );
};

const AKTLabel = () => {
  return <span className="ml-1 text-sm font-semibold">AKT</span>;
};
