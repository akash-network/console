import React from "react";
import { FormattedNumber } from "react-intl";
import { DashboardData, ProviderSnapshotsUrlParam, SnapshotsUrlParam } from "@src/types";
import Paper from "@mui/material/Paper";
import { makeStyles } from "tss-react/mui";
import Box from "@mui/material/Box";
import { percIncrease, udenomToDenom } from "@src/utils/mathHelpers";
import { HumanReadableBytes } from "../shared/HumanReadableBytes";
import Grid from "@mui/material/Grid";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Button from "@mui/material/Button";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { Title } from "../shared/Title";
import { CustomTableHeader } from "../shared/CustomTable";
import { useMarketData } from "@src/queries";
import { StatsCard } from "./StatsCard";
import { FormattedDecimalCurrency } from "../shared/FormattedDecimalCurrency";
import { DiffPercentageChip } from "../shared/DiffPercentageChip";
import { useTheme } from "@mui/material";
import { uaktToAKT } from "@src/utils/priceUtils";
import { BlockRow } from "../blockchain/BlockRow";
import { TransactionRow } from "../blockchain/TransactionRow";
import { useSelectedNetwork } from "@src/utils/networks";

interface IDashboardProps {
  dashboardData: DashboardData;
}

const useStyles = makeStyles()(theme => ({
  link: {
    textDecoration: "underline"
  },
  liveChip: {
    "&&": {
      fontWeight: "normal",
      marginLeft: "1rem",
      fontSize: ".8rem",
      height: "20px"
    }
  },
  priceDataContainer: {
    padding: "1rem",
    marginBottom: "1.5rem",
    borderRadius: ".5rem",
    display: "flex",
    alignItems: "center",
    fontSize: "1rem",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "baseline"
    }
  },
  priceData: {
    marginLeft: "1rem",
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    [theme.breakpoints.down("sm")]: {
      marginLeft: "0"
    }
  },
  priceDataValue: {
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    marginLeft: ".5rem"
  },
  loadMoreButton: {
    borderColor: theme.palette.mode === "dark" ? theme.palette.grey[600] : theme.palette.grey[400],
    textTransform: "initial"
  }
}));

export const Dashboard: React.FunctionComponent<IDashboardProps> = ({ dashboardData }) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const { data: marketData } = useMarketData();
  const memoryDiff = bytesToShrink(dashboardData.now.activeMemory - dashboardData.compare.activeMemory);
  const storageDiff = bytesToShrink(dashboardData.now.activeStorage - dashboardData.compare.activeStorage);
  const capacityMemoryDiff = bytesToShrink(dashboardData.networkCapacityStats.now.memory - dashboardData.networkCapacityStats.compare.memory);
  const capacityStorageDiff = bytesToShrink(dashboardData.networkCapacityStats.now.storage - dashboardData.networkCapacityStats.compare.storage);
  const selectedNetwork = useSelectedNetwork();
  const statsGridWidth = 2.4;

  return (
    <>
      {marketData && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} lg={3}>
            <StatsCard
              text="AKT Price"
              number={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <FormattedDecimalCurrency style="currency" currency="USD" value={marketData.price} precision={2} />

                  <DiffPercentageChip value={marketData.priceChangePercentage24 / 100} />
                </Box>
              }
            />
          </Grid>

          <Grid item xs={12} lg={3}>
            <StatsCard text="Market Cap" number={<FormattedDecimalCurrency style="currency" currency="USD" value={marketData.marketCap} precision={0} />} />
          </Grid>

          <Grid item xs={12} lg={3}>
            <StatsCard text="Volume (24h)" number={<FormattedDecimalCurrency style="currency" currency="USD" value={marketData.volume} precision={0} />} />
          </Grid>

          <Grid item xs={12} lg={3}>
            <StatsCard text="Rank" number={marketData.marketCapRank} />
          </Grid>
        </Grid>
      )}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Title value="Network Summary" subTitle sx={{ textAlign: { sm: "center" } }} />
        </Grid>

        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <span>
                  <FormattedNumber value={uaktToAKT(dashboardData.now.dailyUAktSpent)} maximumFractionDigits={2} />
                </span>
                <AKTLabel />
              </>
            }
            text="AKT spent (24h)"
            tooltip="Last 24h"
            graphPath={UrlService.graph(SnapshotsUrlParam.dailyAktSpent)}
            diffNumber={uaktToAKT(dashboardData.now.dailyUAktSpent - dashboardData.compare.dailyUAktSpent)}
            diffPercent={percIncrease(dashboardData.compare.dailyUAktSpent, dashboardData.now.dailyUAktSpent)}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={uaktToAKT(dashboardData.now.totalUAktSpent)} maximumFractionDigits={2} /> <AKTLabel />
              </>
            }
            text="Total spent AKT"
            tooltip="This is the total amount akt spent to rent computing power on the akash network since the beginning of the network. (March 2021)"
            graphPath={UrlService.graph(SnapshotsUrlParam.totalAKTSpent)}
            diffNumber={uaktToAKT(dashboardData.now.totalUAktSpent - dashboardData.compare.totalUAktSpent)}
            diffPercent={percIncrease(dashboardData.compare.totalUAktSpent, dashboardData.now.totalUAktSpent)}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount} />}
            text="New leases (24h)"
            tooltip="Last 24h"
            graphPath={UrlService.graph(SnapshotsUrlParam.dailyDeploymentCount)}
            diffNumber={dashboardData.now.dailyLeaseCount - dashboardData.compare.dailyLeaseCount}
            diffPercent={percIncrease(dashboardData.compare.dailyLeaseCount, dashboardData.now.dailyLeaseCount)}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.now.totalLeaseCount} />}
            text="Total leases"
            tooltip="The total lease count consists of all deployments that were live at some point and that someone paid for. This includes deployments that were deployed for testing or that were meant to be only temporary."
            graphPath={UrlService.graph(SnapshotsUrlParam.allTimeDeploymentCount)}
            diffNumber={dashboardData.now.totalLeaseCount - dashboardData.compare.totalLeaseCount}
            diffPercent={percIncrease(dashboardData.compare.totalLeaseCount, dashboardData.now.totalLeaseCount)}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Title value="Spent Assets" subTitle sx={{ textAlign: { sm: "center" } }} />
        </Grid>

        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <span>
                  <FormattedNumber value={udenomToDenom(dashboardData.now.dailyUAktSpent)} maximumFractionDigits={2} />
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
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={udenomToDenom(dashboardData.now.totalUAktSpent)} maximumFractionDigits={2} /> <AKTLabel />
              </>
            }
            text="Total spent AKT"
            tooltip="This is the total amount of akt spent to rent computing power on the akash network since the beginning of the network. (March 2021)"
            graphPath={UrlService.graph(SnapshotsUrlParam.totalAKTSpent)}
            diffNumber={udenomToDenom(dashboardData.now.totalUAktSpent - dashboardData.compare.totalUAktSpent)}
            diffPercent={percIncrease(dashboardData.compare.totalUAktSpent, dashboardData.now.totalUAktSpent)}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <span>
                  <FormattedNumber value={udenomToDenom(dashboardData.now.dailyUUsdcSpent)} maximumFractionDigits={2} />
                </span>
                USDC
              </>
            }
            text="USDC spent (24h)"
            tooltip="Last 24h"
            graphPath={UrlService.graph(SnapshotsUrlParam.dailyUsdcSpent)}
            diffNumber={udenomToDenom(dashboardData.now.dailyUUsdcSpent - dashboardData.compare.dailyUUsdcSpent)}
            diffPercent={percIncrease(dashboardData.compare.dailyUUsdcSpent, dashboardData.now.dailyUUsdcSpent)}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={udenomToDenom(dashboardData.now.totalUUsdcSpent)} maximumFractionDigits={2} /> USDC
              </>
            }
            text="Total spent USDC"
            tooltip="This is the total amount of usdc spent to rent computing power on the akash network since the beginning of the network. (March 2021)"
            graphPath={UrlService.graph(SnapshotsUrlParam.totalUSDCSpent)}
            diffNumber={udenomToDenom(dashboardData.now.totalUUsdcSpent - dashboardData.compare.totalUUsdcSpent)}
            diffPercent={percIncrease(dashboardData.compare.totalUUsdcSpent, dashboardData.now.totalUUsdcSpent)}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Title value="Total resources leased" subTitle sx={{ textAlign: { sm: "center" } }} />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.now.activeLeaseCount} />}
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
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={dashboardData.now.activeCPU / 1000} maximumFractionDigits={2} />
                <small style={{ paddingLeft: "5px", fontWeight: "bold", fontSize: 16 }}>CPU</small>
              </>
            }
            text="Compute"
            graphPath={UrlService.graph(SnapshotsUrlParam.compute)}
            diffNumber={(dashboardData.now.activeCPU - dashboardData.compare.activeCPU) / 1000}
            diffPercent={percIncrease(dashboardData.compare.activeCPU, dashboardData.now.activeCPU)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={dashboardData.now.activeGPU} maximumFractionDigits={2} />
                <small style={{ paddingLeft: "5px", fontWeight: "bold", fontSize: 16 }}>GPU</small>
              </>
            }
            text="Graphics"
            graphPath={UrlService.graph(SnapshotsUrlParam.graphics)}
            diffNumber={dashboardData.now.activeGPU - dashboardData.compare.activeGPU}
            diffPercent={percIncrease(dashboardData.compare.activeGPU, dashboardData.now.activeGPU)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<HumanReadableBytes value={dashboardData.now.activeMemory} />}
            text="Memory"
            graphPath={UrlService.graph(SnapshotsUrlParam.memory)}
            diffNumberUnit={memoryDiff.unit}
            diffNumber={memoryDiff.value}
            diffPercent={percIncrease(dashboardData.compare.activeMemory, dashboardData.now.activeMemory)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<HumanReadableBytes value={dashboardData.now.activeStorage} />}
            text="Storage"
            graphPath={UrlService.graph(SnapshotsUrlParam.storage)}
            diffNumberUnit={storageDiff.unit}
            diffNumber={storageDiff.value}
            diffPercent={percIncrease(dashboardData.compare.activeStorage, dashboardData.now.activeStorage)}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Title value="Network Capacity" subTitle sx={{ textAlign: { sm: "center" } }} />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<FormattedNumber value={dashboardData.networkCapacity.activeProviderCount} />}
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
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={dashboardData.networkCapacity.totalCPU / 1000} maximumFractionDigits={0} />
                <small style={{ paddingLeft: ".25rem", fontWeight: "bold", fontSize: 16 }}>CPU</small>
              </>
            }
            text="Compute"
            graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.cpu)}
            diffNumber={(dashboardData.networkCapacityStats.now.cpu - dashboardData.networkCapacityStats.compare.cpu) / 1000}
            diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.cpu, dashboardData.networkCapacityStats.now.cpu)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={
              <>
                <FormattedNumber value={dashboardData.networkCapacity.totalGPU} maximumFractionDigits={0} />
                <small style={{ paddingLeft: ".25rem", fontWeight: "bold", fontSize: 16 }}>GPU</small>
              </>
            }
            text="Graphics"
            graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.gpu)}
            diffNumber={dashboardData.networkCapacityStats.now.gpu - dashboardData.networkCapacityStats.compare.gpu}
            diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.gpu, dashboardData.networkCapacityStats.now.gpu)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<HumanReadableBytes value={dashboardData.networkCapacity.totalMemory} />}
            text="Memory"
            diffNumberUnit={capacityMemoryDiff.unit}
            diffNumber={capacityMemoryDiff.value}
            diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.memory, dashboardData.networkCapacityStats.now.memory)}
            graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.memory)}
          />
        </Grid>

        <Grid item xs={12} lg={statsGridWidth}>
          <StatsCard
            number={<HumanReadableBytes value={dashboardData.networkCapacity.totalStorage} />}
            text="Storage"
            graphPath={UrlService.providerGraph(ProviderSnapshotsUrlParam.storage)}
            diffNumberUnit={capacityStorageDiff.unit}
            diffNumber={capacityStorageDiff.value}
            diffPercent={percIncrease(dashboardData.networkCapacityStats.compare.storage, dashboardData.networkCapacityStats.now.storage)}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 4 }}>
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
      </Grid>
      <Grid container spacing={2} sx={{ mb: 4 }}>
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
      </Grid>
    </>
  );
};

const AKTLabel = () => {
  return (
    <Box component="span" sx={{ marginLeft: ".5rem", fontSize: ".75rem", fontWeight: 300 }}>
      AKT
    </Box>
  );
};
