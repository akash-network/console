"use client";
import { useEffect, useState } from "react";
import { FormattedNumber, FormattedPlural } from "react-intl";
import { ResponsivePie } from "@nivo/pie";
import { Rocket } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useTheme } from "next-themes";

import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import useTailwind from "@src/hooks/useTailwind";
import sdlStore from "@src/store/sdlStore";
import { Balances } from "@src/types";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { customColors } from "@src/utils/colors";
import { uAktDenom } from "@src/utils/constants";
import { roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth, uaktToAKT } from "@src/utils/priceUtils";
import { cn } from "@src/utils/styleUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ConnectWallet } from "../shared/ConnectWallet";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { PriceValue } from "../shared/PriceValue";
import Spinner from "../shared/Spinner";
import { StatusPill } from "../shared/StatusPill";
import { buttonVariants, Badge } from "@akashnetwork/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

// const LiquidityModal = dynamic(() => import("../liquidity-modal"), {
//   ssr: false,
//   loading: props => {
//     if (props.isLoading) {
//       return (
//         <Button variant="default" disabled size="sm">
//           <span>Get More</span>
//           <Spinner size="small" className="ml-2" />
//         </Button>
//       );
//     } else return null;
//   }
// });

type Props = {
  balances: Balances | undefined;
  isLoadingBalances: boolean;
  activeDeployments: Array<DeploymentDto>;
  leases: Array<LeaseDto> | null | undefined;
  providers: Array<ApiProviderList> | undefined;
};

export const YourAccount: React.FunctionComponent<Props> = ({ balances, isLoadingBalances, activeDeployments, leases, providers }) => {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();
  const { address } = useWallet();
  const usdcIbcDenom = useUsdcDenom();
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);
  const [costPerMonth, setCostPerMonth] = useState<number | null>(null);
  const [userProviders, setUserProviders] = useState<{ owner: string; name: string }[] | null>(null);
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
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a = 0, b = 0) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { price, isLoaded } = usePricing();

  const colors = {
    balance_akt: customColors.akashRed,
    balance_usdc: customColors.akashRed,
    deployment_akt: tw.theme.colors.green[600],
    deployment_usdc: tw.theme.colors.green[600]
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
      const totalCostPerBlock = activeLeases
        .map(x => {
          switch (x.price.denom) {
            case uAktDenom:
              return udenomToDenom(x.price.amount, 10) * price;
            case usdcIbcDenom:
              return udenomToDenom(x.price.amount, 10);

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
          return { owner: provider?.owner || "", name: provider?.name || "Unknown" };
        });

      setCostPerMonth(getAvgCostPerMonth(totalCostPerBlock));
      setUserProviders(_userProviders);
    }
  }, [leases, providers, price, isLoaded]);

  const _getColor = bar => getColor(bar.id, selectedDataId);
  const getColor = (id, selectedId) => {
    if (!selectedId || id === selectedId) {
      return colors[id];
    } else {
      return resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : "#e0e0e0";
    }
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Your Account</CardTitle>
      </CardHeader>

      <CardContent>
        {address && (
          <div className="flex flex-col justify-between lg:flex-row">
            {isLoadingBalances && !balances && (
              <div className="flex h-[200px] basis-[220px] items-center justify-center">
                <Spinner size="large" />
              </div>
            )}

            <div className="basis-2/5">
              <div className="flex items-center">
                {activeDeployments.length > 0 && <StatusPill state="active" style={{ marginLeft: 0 }} />}
                <p className={cn({ ["ml-4"]: activeDeployments.length > 0 })}>
                  You have{" "}
                  <Link href={UrlService.deploymentList()} passHref>
                    {activeDeployments.length} active{" "}
                    <FormattedPlural value={activeDeployments.length} zero="deployment" one="deployment" other="deployments" />
                  </Link>
                </p>
              </div>

              {activeDeployments.length > 0 ? (
                <>
                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Total resources leased</p>

                    <div className="flex flex-col items-start">
                      <LeaseSpecDetail type="cpu" value={totalCpu} />
                      {!!totalGpu && <LeaseSpecDetail type="gpu" value={totalGpu} />}
                      <LeaseSpecDetail type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
                      <LeaseSpecDetail type="storage" value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`} />
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Total cost</p>

                    <div className="flex items-center">
                      <p>
                        <strong>
                          <FormattedNumber
                            value={costPerMonth || 0}
                            // eslint-disable-next-line react/style-prop-object
                            style="currency"
                            currency="USD"
                          />
                        </strong>{" "}
                        / month
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Providers</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {userProviders?.map(p => (
                        <Link key={p.owner} href={UrlService.providerDetailLeases(p.owner)}>
                          <Badge>{p.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <Link href={UrlService.newDeployment()} className={cn("mt-4", buttonVariants({ variant: "default" }))} onClick={onDeployClick}>
                  Deploy
                  <Rocket className="ml-4 rotate-45 text-sm" />
                </Link>
              )}
            </div>

            <div className="mt-4 flex basis-3/5 flex-col items-center md:mt-0 md:flex-row">
              {hasBalance && (
                <div>
                  {filteredAktData.length > 0 && <BalancePie data={filteredAktData} getColor={_getColor} label="AKT" />}
                  {filteredUsdcData.length > 0 && <BalancePie data={filteredUsdcData} getColor={_getColor} label="USDC" />}
                </div>
              )}

              {balances && (
                <div className={cn({ ["p-4"]: !hasBalance })} onMouseLeave={() => setSelectedDataId(null)}>
                  {allData.map((balance, i) => (
                    <div
                      className="mb-2 flex items-center text-xs leading-5 transition-opacity duration-200 ease-in-out"
                      key={i}
                      onMouseEnter={() => setSelectedDataId(balance.id)}
                      style={{ opacity: !selectedDataId || balance.id === selectedDataId ? 1 : 0.3 }}
                    >
                      <div className="h-4 w-4 rounded-lg" style={{ backgroundColor: balance.color }} />
                      <div className="ml-4 w-[90px] font-bold">{balance.label}</div>
                      <div className="ml-4 w-[100px]">
                        {udenomToDenom(balance.value, 2)} {balance.denomLabel}
                      </div>

                      <div>
                        <PriceValue denom={balance.denom} value={udenomToDenom(balance.value, 6)} />
                      </div>
                    </div>
                  ))}

                  <div className="mb-2 flex items-center text-sm leading-5 transition-opacity duration-200 ease-in-out">
                    <div className="h-4 w-4 rounded-lg" />
                    <div className="ml-4 w-[90px] font-bold">Total</div>
                    <div className="ml-4 w-[100px]">
                      <strong>{uaktToAKT(totalUAkt, 2)} AKT</strong>
                    </div>

                    <div>
                      <strong>
                        <PriceValue denom={uAktDenom} value={uaktToAKT(totalUAkt, 6)} />
                      </strong>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center text-sm leading-5 transition-opacity duration-200 ease-in-out">
                    <div className="h-4 w-4 rounded-lg" />
                    <div className="ml-4 w-[90px] font-bold"></div>
                    <div className="ml-4 w-[100px]">
                      <strong>{udenomToDenom(totalUsdc, 2)} USDC</strong>
                    </div>

                    <div>
                      <strong>
                        <PriceValue denom={usdcIbcDenom} value={udenomToDenom(totalUsdc, 6)} />
                      </strong>
                    </div>
                  </div>

                  <div className="mb-2 mt-2 flex items-center border-t border-muted-foreground pt-2 text-sm leading-5 transition-opacity duration-200 ease-in-out">
                    <div className="h-4 w-4 rounded-lg" />
                    <div className="ml-4 w-[90px] font-bold"></div>
                    <div className="ml-4 w-[100px]"></div>

                    <div>
                      <strong>
                        <FormattedNumber
                          value={udenomToDenom(totalUsdc, 6) + udenomToDenom(totalUAkt, 6) * (price || 0)}
                          // eslint-disable-next-line react/style-prop-object
                          style="currency"
                          currency="USD"
                        />
                      </strong>
                    </div>
                  </div>

                  {/* <div className="flex items-center justify-end">
                    <LiquidityModal address={address} aktBalance={aktBalance} refreshBalances={refreshBalances} />
                  </div> */}
                </div>
              )}
            </div>
          </div>
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
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex h-[200px] w-[220px] items-center justify-center">
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
          <div className="flex items-center rounded bg-muted px-2 py-1">
            <div className="h-2 w-2" style={{ backgroundColor: value.datum.color }} />
            <div className="ml-2">
              {value.datum.label}: {value.datum.formattedValue}
            </div>
          </div>
        )}
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={10}
        theme={{
          // background: theme === "dark" ? lighten(theme.palette.background.paper, 0.0525) : theme.palette.background.paper,
          textColor: "#fff",
          fontSize: 12,
          tooltip: {
            basic: {
              color: resolvedTheme === "dark" ? "#fff" : customColors.main
            },
            container: {
              backgroundColor: resolvedTheme === "dark" ? customColors.main : "#fff"
            }
          }
        }}
      />
    </div>
  );
};
