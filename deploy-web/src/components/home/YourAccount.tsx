import { useEffect, useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import { makeStyles } from "tss-react/mui";
import { Box, Button, Card, CardContent, CardHeader, Chip, CircularProgress, lighten, Typography, useTheme } from "@mui/material";
import { uaktToAKT } from "@src/utils/priceUtils";
import { PriceValue } from "../shared/PriceValue";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { StatusPill } from "../shared/StatusPill";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { FormattedNumber, FormattedPlural } from "react-intl";
import { useRouter } from "next/router";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ConnectWallet } from "../shared/ConnectWallet";
import { Balances } from "@src/types";
import { ApiProviderList } from "@src/types/provider";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { usePricing } from "@src/context/PricingProvider";
import { uAktDenom } from "@src/utils/constants";
import { useUsdcDenom } from "@src/hooks/useDenom";

const useStyles = makeStyles()(theme => ({
  legendRow: {
    display: "flex",
    alignItems: "center",
    fontSize: ".75rem",
    lineHeight: "1.25rem",
    transition: "opacity .2s ease",
    marginBottom: ".2rem"
  },
  legendColor: {
    width: "1rem",
    height: "1rem",
    borderRadius: "1rem"
  },
  legendLabel: {
    marginLeft: "1rem",
    fontWeight: "bold",
    width: "90px"
  },
  legendValue: {
    marginLeft: "1rem",
    width: "100px"
  },
  title: {
    fontSize: "1rem",
    fontWeight: "bold",
    marginBottom: ".5rem"
  }
}));

type Props = {
  balances: Balances;
  isLoadingBalances: boolean;
  activeDeployments: Array<DeploymentDto>;
  leases: Array<LeaseDto>;
  providers: Array<ApiProviderList>;
};

export const YourAccount: React.FunctionComponent<Props> = ({ balances, isLoadingBalances, activeDeployments, leases, providers }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { address } = useKeplr();
  const usdcIbcDenom = useUsdcDenom();
  const [selectedDataId, setSelectedDataId] = useState(null);
  const [costPerMonth, setCostPerMonth] = useState(null);
  const [userProviders, setUserProviders] = useState(null);
  const escrowUAktSum = activeDeployments
    .filter(x => x.escrowAccount.balance.denom === uAktDenom)
    .map(x => x.escrowBalance)
    .reduce((a, b) => a + b, 0);
  const escrowUsdcSum = activeDeployments
    .filter(x => x.escrowAccount.balance.denom === usdcIbcDenom)
    .map(x => x.escrowBalance)
    .reduce((a, b) => a + b, 0);
  const totalUAkt = balances ? balances.balance + escrowUAktSum : 0;
  const totalUsdc = balances ? balances.balanceUsdc + escrowUsdcSum : 0;
  const hasBalance = balances && totalUAkt !== 0;
  const totalCpu = activeDeployments.map(d => d.cpuAmount).reduce((a, b) => a + b, 0);
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a, b) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [deploySdl, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { price, isLoaded } = usePricing();

  const colors = {
    balance_akt: "#dd4320",
    balance_usdc: "#dd4320",
    deployment_akt: theme.palette.success.dark,
    deployment_usdc: theme.palette.success.dark
  };

  const getAktData = (balances: Balances, escrowUAktSum: number) => {
    return [
      {
        id: "balance_akt",
        label: "Balance",
        denom: uAktDenom,
        denomLabel: "AKT",
        value: balances.balance,
        color: colors.balance_akt
      },
      {
        id: "deployment_akt",
        label: "Deployment",
        denom: uAktDenom,
        denomLabel: "AKT",
        value: escrowUAktSum,
        color: colors.deployment_akt
      }
    ];
  };
  const getUsdcData = (balances: Balances, escrowUsdcSum: number) => {
    return [
      {
        id: "balance_usdc",
        label: "Balance",
        denom: usdcIbcDenom,
        denomLabel: "USDC",
        value: balances.balanceUsdc,
        color: colors.balance_usdc
      },
      {
        id: "deployment_usdc",
        label: "Deployment",
        denom: usdcIbcDenom,
        denomLabel: "USDC",
        value: escrowUsdcSum,
        color: colors.deployment_usdc
      }
    ];
  };
  const aktData = balances ? getAktData(balances, escrowUAktSum) : [];
  const usdcData = balances ? getUsdcData(balances, escrowUsdcSum) : [];
  const filteredAktData = aktData.filter(x => x.value);
  const filteredUsdcData = usdcData.filter(x => x.value);
  const allData = [...aktData, ...usdcData];

  useEffect(() => {
    if (leases && providers && price && isLoaded) {
      const activeLeases = leases.filter(x => x.state === "active");
      const totalCost = activeLeases
        .map(x => {
          switch (x.price.denom) {
            case uAktDenom:
              return parseFloat(x.price.amount) * price;
            case usdcIbcDenom:
              return parseFloat(x.price.amount);

            default:
              return 0;
          }
        })
        .reduce((a, b) => a + b, 0);

      const _userProviders = activeLeases
        .map(x => x.provider)
        .filter((value, index, array) => array.indexOf(value) === index)
        .map(x => {
          const provider = providers.find(p => p.owner === x);
          return { owner: provider.owner, name: provider.name };
        });

      setCostPerMonth(totalCost);
      setUserProviders(_userProviders);
    }
  }, [leases, providers, price, isLoaded]);

  const _getColor = bar => getColor(bar.id, selectedDataId);
  const getColor = (id, selectedId) => {
    if (!selectedId || id === selectedId) {
      return colors[id];
    } else {
      return theme.palette.mode === "dark" ? theme.palette.grey[900] : "#e0e0e0";
    }
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  return (
    <Card elevation={1}>
      <CardHeader
        title="Your Account"
        titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
        sx={{ borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` }}
      />

      <CardContent>
        {address && (
          <Box sx={{ display: "flex", justifyContent: "space-between", flexDirection: { xs: "column", lg: "row" } }}>
            {isLoadingBalances && !balances && (
              <Box flexBasis="220px" height="200px" display="flex" alignItems="center" justifyContent="center">
                <CircularProgress size="3rem" color="secondary" />
              </Box>
            )}

            <Box sx={{ flexBasis: "40%" }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {activeDeployments.length > 0 && <StatusPill state="active" style={{ marginLeft: 0 }} />}
                <Typography variant="body1" sx={{ marginLeft: activeDeployments.length > 0 ? "1rem" : 0 }}>
                  You have{" "}
                  <Link href={UrlService.deploymentList()} passHref>
                    {activeDeployments.length} active{" "}
                    <FormattedPlural value={activeDeployments.length} zero="deployment" one="deployment" other="deployments" />
                  </Link>
                </Typography>
              </Box>

              {activeDeployments.length > 0 ? (
                <>
                  <Box sx={{ marginTop: "2rem" }}>
                    <Typography variant="body2" color="textSecondary" sx={{ marginBottom: "1rem" }}>
                      Total resources leased
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "start", flexDirection: "column" }}>
                      <LeaseSpecDetail type="cpu" value={totalCpu} />
                      {!!totalGpu && <LeaseSpecDetail type="gpu" value={totalGpu} />}
                      <LeaseSpecDetail type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
                      <LeaseSpecDetail type="storage" value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`} />
                    </Box>
                  </Box>

                  <Box sx={{ marginTop: "2rem" }}>
                    <Typography variant="body2" color="textSecondary" sx={{ marginBottom: "1rem" }}>
                      Total cost
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="body1">
                        <strong>
                          <FormattedNumber
                            value={costPerMonth}
                            // eslint-disable-next-line react/style-prop-object
                            style="currency"
                            currency="USD"
                          />
                        </strong>{" "}
                        / month
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ marginTop: "2rem" }}>
                    <Typography variant="body2" color="textSecondary" sx={{ marginBottom: "1rem" }}>
                      Providers
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      {userProviders?.map((p, i) => (
                        <Chip
                          key={p.owner}
                          label={p.name}
                          size="small"
                          clickable
                          color="secondary"
                          variant="outlined"
                          onClick={() => router.push(UrlService.providerDetail(p.owner))}
                          sx={{ marginLeft: i > 0 ? ".5rem" : 0 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </>
              ) : (
                <Button
                  href={UrlService.newDeployment()}
                  component={Link}
                  variant="contained"
                  size="medium"
                  color="secondary"
                  sx={{ marginTop: "1rem" }}
                  onClick={onDeployClick}
                >
                  Deploy
                  <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
                </Button>
              )}
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexBasis: "60%",
                marginTop: { xs: "1rem", sm: "1rem", md: 0 },
                flexDirection: { xs: "column", sm: "column", md: "row" }
              }}
            >
              {hasBalance && (
                <Box>
                  {filteredAktData.length > 0 && <BalancePie data={filteredAktData} getColor={_getColor} label="AKT" />}
                  {filteredUsdcData.length > 0 && <BalancePie data={filteredUsdcData} getColor={_getColor} label="USDC" />}
                </Box>
              )}

              {balances && (
                <Box padding={hasBalance ? 0 : "1rem"} onMouseLeave={() => setSelectedDataId(null)}>
                  {allData.map((balance, i) => (
                    <div
                      className={classes.legendRow}
                      key={i}
                      onMouseEnter={() => setSelectedDataId(balance.id)}
                      style={{ opacity: !selectedDataId || balance.id === selectedDataId ? 1 : 0.3 }}
                    >
                      <div className={classes.legendColor} style={{ backgroundColor: balance.color }} />
                      <div className={classes.legendLabel}>{balance.label}</div>
                      <div className={classes.legendValue}>
                        {udenomToDenom(balance.value, 2)} {balance.denomLabel}
                      </div>

                      <div>
                        <PriceValue denom={balance.denom} value={udenomToDenom(balance.value, 6)} />
                      </div>
                    </div>
                  ))}

                  <Box className={classes.legendRow} sx={{ fontSize: ".9rem !important" }}>
                    <div className={classes.legendColor} />
                    <div className={classes.legendLabel}>Total</div>
                    <div className={classes.legendValue}>
                      <strong>{uaktToAKT(totalUAkt, 2)} AKT</strong>
                    </div>

                    <div>
                      <strong>
                        <PriceValue denom={uAktDenom} value={uaktToAKT(totalUAkt, 6)} />
                      </strong>
                    </div>
                  </Box>
                  <Box className={classes.legendRow} sx={{ fontSize: ".9rem !important" }}>
                    <div className={classes.legendColor} />
                    <div className={classes.legendLabel}></div>
                    <div className={classes.legendValue}>
                      <strong>{udenomToDenom(totalUsdc, 2)} USDC</strong>
                    </div>

                    <div>
                      <strong>
                        <PriceValue denom={usdcIbcDenom} value={udenomToDenom(totalUsdc, 6)} />
                      </strong>
                    </div>
                  </Box>

                  <Box
                    className={classes.legendRow}
                    sx={{
                      fontSize: ".9rem !important",
                      marginTop: ".5rem",
                      paddingTop: ".5rem",
                      borderTop: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}`
                    }}
                  >
                    <div className={classes.legendColor} />
                    <div className={classes.legendLabel}></div>
                    <div className={classes.legendValue}></div>

                    <div>
                      <strong>
                        <FormattedNumber
                          value={udenomToDenom(totalUsdc, 6) + udenomToDenom(totalUAkt, 6) * price}
                          // eslint-disable-next-line react/style-prop-object
                          style="currency"
                          currency="USD"
                        />
                      </strong>
                    </div>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {!address && <ConnectWallet text="Connect your wallet to deploy!" />}
      </CardContent>
    </Card>
  );
};

type BalancePieProps = {
  label: string;
  data: Array<any>;
  getColor: (bar: any) => string;
};

const BalancePie: React.FunctionComponent<BalancePieProps> = ({ label, data, getColor }) => {
  const theme = useTheme();
  return (
    <Box height="200px" width="220px" display="flex" alignItems="center" justifyContent="center">
      <ResponsivePie
        data={data}
        margin={{ top: 15, right: 15, bottom: 15, left: 0 }}
        innerRadius={0.4}
        padAngle={2}
        cornerRadius={4}
        activeOuterRadiusOffset={8}
        colors={getColor}
        borderWidth={0}
        borderColor={{
          from: "color",
          modifiers: [["darker", 0.2]]
        }}
        valueFormat={value => {
          return `${udenomToDenom(value, 2)} ${label}`;
        }}
        tooltip={value => (
          <Box
            sx={{
              backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300],
              padding: ".25rem .5rem",
              borderRadius: ".25rem",
              display: "flex",
              alignItems: "center"
            }}
          >
            <Box sx={{ width: ".5rem", height: ".5rem", backgroundColor: value.datum.color }} />
            <Box sx={{ marginLeft: ".5rem" }}>
              {value.datum.label}: {value.datum.formattedValue}
            </Box>
          </Box>
        )}
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={10}
        theme={{
          background: theme.palette.mode === "dark" ? lighten(theme.palette.background.paper, 0.0525) : theme.palette.background.paper,
          textColor: "#fff",
          fontSize: 12,
          tooltip: {
            basic: {
              color: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
            },
            container: {
              backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.primary.contrastText
            }
          }
        }}
      />
    </Box>
  );
};
