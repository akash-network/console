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
import { roundDecimal } from "@src/utils/mathHelpers";
import { PricePerMonth } from "../shared/PricePerMonth";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { FormattedPlural } from "react-intl";
import { useRouter } from "next/router";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ConnectWallet } from "../shared/ConnectWallet";
import { Balances } from "@src/types";
import { RpcProvider } from "@src/types/provider";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";

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
  escrowSum: number;
  activeDeployments: Array<DeploymentDto>;
  leases: Array<LeaseDto>;
  providers: Array<RpcProvider>;
};

export const YourAccount: React.FunctionComponent<Props> = ({ balances, isLoadingBalances, escrowSum, activeDeployments, leases, providers }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { address } = useKeplr();
  const [selectedDataId, setSelectedDataId] = useState(null);
  const [costPerMonth, setCostPerMonth] = useState(null);
  const [userProviders, setUserProviders] = useState(null);
  const total = balances ? balances.balance + escrowSum : 0;
  const hasBalance = balances && total !== 0;
  const totalCpu = activeDeployments.map(d => d.cpuAmount).reduce((a, b) => a + b, 0);
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a, b) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [deploySdl, setDeploySdl] = useAtom(sdlStore.deploySdl);

  const colors = {
    balance: "#dd4320",
    deployment: theme.palette.success.dark
  };

  const getData = (balances: Balances, escrowSum: number) => {
    return [
      {
        id: "balance",
        label: "Balance",
        value: balances.balance,
        color: colors.balance
      },
      {
        id: "deployment",
        label: "Deployment",
        value: escrowSum,
        color: colors.deployment
      }
    ];
  };
  const data = balances ? getData(balances, escrowSum) : [];
  const filteredData = data.filter(x => x.value);

  useEffect(() => {
    if (leases && providers) {
      const activeLeases = leases.filter(x => x.state === "active");
      const totalCost = activeLeases.map(x => parseFloat(x.price.amount)).reduce((a, b) => a + b, 0);

      const _userProviders = activeLeases
        .map(x => x.provider)
        .filter((value, index, array) => array.indexOf(value) === index)
        .map(x => {
          const provider = providers.find(p => p.owner === x);
          const providerUri = new URL(provider?.host_uri);
          return { owner: provider.owner, name: providerUri?.hostname };
        });

      setCostPerMonth(totalCost);
      setUserProviders(_userProviders);
    }
  }, [leases, providers]);

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
                    <a>
                      {activeDeployments.length} active{" "}
                      <FormattedPlural value={activeDeployments.length} zero="deployment" one="deployment" other="deployments" />
                    </a>
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
                      <PricePerMonth perBlockValue={uaktToAKT(costPerMonth, 6)} />
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
                <Link href={UrlService.newDeployment()} passHref>
                  <Button variant="contained" size="medium" color="secondary" sx={{ marginTop: "1rem" }} onClick={onDeployClick}>
                    Deploy
                    <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
                  </Button>
                </Link>
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
                <Box height="200px" width="220px" display="flex" alignItems="center" justifyContent="center">
                  <ResponsivePie
                    data={filteredData}
                    margin={{ top: 15, right: 15, bottom: 15, left: 0 }}
                    innerRadius={0.4}
                    padAngle={2}
                    cornerRadius={4}
                    activeOuterRadiusOffset={8}
                    colors={_getColor}
                    borderWidth={0}
                    borderColor={{
                      from: "color",
                      modifiers: [["darker", 0.2]]
                    }}
                    valueFormat={value => `${uaktToAKT(value, 2)} AKT`}
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
              )}

              {balances && (
                <Box padding={hasBalance ? 0 : "1rem"} onMouseLeave={() => setSelectedDataId(null)}>
                  {data.map((balance, i) => (
                    <div
                      className={classes.legendRow}
                      key={i}
                      onMouseEnter={() => setSelectedDataId(balance.id)}
                      style={{ opacity: !selectedDataId || balance.id === selectedDataId ? 1 : 0.3 }}
                    >
                      <div className={classes.legendColor} style={{ backgroundColor: balance.color }} />
                      <div className={classes.legendLabel}>{balance.label}</div>
                      <div className={classes.legendValue}>{uaktToAKT(balance.value, 2)} AKT</div>
                      {!!balance.value && (
                        <div>
                          <PriceValue value={uaktToAKT(balance.value, 6)} />
                        </div>
                      )}
                    </div>
                  ))}

                  <Box className={classes.legendRow} sx={{ fontSize: ".9rem !important" }}>
                    <div className={classes.legendColor} />
                    <div className={classes.legendLabel}>Total</div>
                    <div className={classes.legendValue}>
                      <strong>{uaktToAKT(total, 2)} AKT</strong>
                    </div>
                    {!!total && (
                      <div>
                        <strong>
                          <PriceValue value={uaktToAKT(total, 6)} />
                        </strong>
                      </div>
                    )}
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
