"use strict";
"use client";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YourAccount = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var pie_1 = require("@nivo/pie");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var next_themes_1 = require("next-themes");
var AddFundsLink_1 = require("@src/components/user/AddFundsLink");
var browser_env_config_1 = require("@src/config/browser-env.config");
var denom_config_1 = require("@src/config/denom.config");
var PricingProvider_1 = require("@src/context/PricingProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useDenom_1 = require("@src/hooks/useDenom");
var useFlag_1 = require("@src/hooks/useFlag");
var useTailwind_1 = require("@src/hooks/useTailwind");
var sdlStore_1 = require("@src/store/sdlStore");
var colors_1 = require("@src/utils/colors");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var unitUtils_1 = require("@src/utils/unitUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var shared_1 = require("../shared");
var ConnectWallet_1 = require("../shared/ConnectWallet");
var LeaseSpecDetail_1 = require("../shared/LeaseSpecDetail");
var PriceValue_1 = require("../shared/PriceValue");
var StatusPill_1 = require("../shared/StatusPill");
var YourAccount = function (_a) {
    var _b, _c;
    var isLoadingBalances = _a.isLoadingBalances, walletBalance = _a.walletBalance, activeDeployments = _a.activeDeployments, leases = _a.leases, providers = _a.providers;
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var tw = (0, useTailwind_1.default)();
    var _d = (0, WalletProvider_1.useWallet)(), address = _d.address, isManagedWallet = _d.isManaged, isTrialing = _d.isTrialing;
    var usdcIbcDenom = (0, useDenom_1.useUsdcDenom)();
    var _e = (0, react_1.useState)(null), selectedDataId = _e[0], setSelectedDataId = _e[1];
    var _f = (0, react_1.useState)(null), costPerMonth = _f[0], setCostPerMonth = _f[1];
    var _g = (0, react_1.useState)(null), userProviders = _g[0], setUserProviders = _g[1];
    var hasBalance = !!walletBalance && walletBalance.totalUsd > 0;
    var totalCpu = activeDeployments.map(function (d) { return d.cpuAmount; }).reduce(function (a, b) { return a + b; }, 0);
    var totalGpu = activeDeployments.map(function (d) { return d.gpuAmount; }).reduce(function (a, b) {
        if (a === void 0) { a = 0; }
        if (b === void 0) { b = 0; }
        return a + b;
    }, 0);
    var totalMemory = activeDeployments.map(function (d) { return d.memoryAmount; }).reduce(function (a, b) { return a + b; }, 0);
    var totalStorage = activeDeployments.map(function (d) { return d.storageAmount; }).reduce(function (a, b) { return a + b; }, 0);
    var _ram = (0, unitUtils_1.bytesToShrink)(totalMemory);
    var _storage = (0, unitUtils_1.bytesToShrink)(totalStorage);
    var _h = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _h[1];
    var _j = (0, PricingProvider_1.usePricing)(), price = _j.price, isLoaded = _j.isLoaded;
    var isAnonymousFreeTrialEnabled = (0, useFlag_1.useFlag)("anonymous_free_trial");
    var colors = {
        balance_akt: colors_1.customColors.akashRed,
        balance_usdc: colors_1.customColors.akashRed,
        deployment_akt: tw.theme.colors.green[600],
        deployment_usdc: tw.theme.colors.green[600]
    };
    var getAktData = function (balances) {
        return [
            {
                id: "balance_akt",
                label: "Balance",
                denom: denom_config_1.UAKT_DENOM,
                denomLabel: "AKT",
                value: balances.balanceUAKT,
                color: colors.balance_akt
            },
            {
                id: "deployment_akt",
                label: "Deployments",
                denom: denom_config_1.UAKT_DENOM,
                denomLabel: "AKT",
                value: balances.totalDeploymentEscrowUAKT,
                color: colors.deployment_akt
            }
        ];
    };
    var getUsdcData = function (balances) {
        return [
            {
                id: "balance_usdc",
                label: "Balance",
                denom: usdcIbcDenom,
                denomLabel: "USDC",
                value: balances.balanceUUSDC,
                color: colors.balance_usdc
            },
            {
                id: "deployment_usdc",
                label: "Deployments",
                denom: usdcIbcDenom,
                denomLabel: "USDC",
                value: balances.totalDeploymentEscrowUUSDC,
                color: colors.deployment_usdc
            }
        ];
    };
    var aktData = walletBalance && (!isManagedWallet || browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "uakt") ? getAktData(walletBalance) : [];
    var usdcData = walletBalance && (!isManagedWallet || browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "usdc") ? getUsdcData(walletBalance) : [];
    var filteredAktData = aktData.filter(function (x) { return x.value; });
    var filteredUsdcData = usdcData.filter(function (x) { return x.value; });
    var allData = __spreadArray(__spreadArray([], aktData, true), usdcData, true);
    (0, react_1.useEffect)(function () {
        if (leases && providers && price && isLoaded) {
            var activeLeases = leases.filter(function (x) { return x.state === "active"; });
            var totalCostPerBlock = activeLeases
                .map(function (x) {
                switch (x.price.denom) {
                    case denom_config_1.UAKT_DENOM:
                        return (0, mathHelpers_1.udenomToDenom)(x.price.amount, 10) * price;
                    case usdcIbcDenom:
                        return (0, mathHelpers_1.udenomToDenom)(x.price.amount, 10);
                    default:
                        return 0;
                }
            })
                .reduce(function (a, b) { return a + b; }, 0);
            var _userProviders = activeLeases
                .map(function (x) { return x.provider; })
                .filter(function (value, index, array) { return array.indexOf(value) === index; })
                .map(function (x) {
                var provider = providers.find(function (p) { return p.owner === x; });
                return { owner: (provider === null || provider === void 0 ? void 0 : provider.owner) || "", name: (provider === null || provider === void 0 ? void 0 : provider.name) || "Unknown" };
            });
            setCostPerMonth((0, priceUtils_1.getAvgCostPerMonth)(totalCostPerBlock));
            setUserProviders(_userProviders);
        }
    }, [leases, providers, price, isLoaded]);
    var _getColor = function (bar) { return getColor(bar.id, selectedDataId); };
    var getColor = function (id, selectedId) {
        if (!selectedId || id === selectedId) {
            return colors[id];
        }
        else {
            return resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : "#e0e0e0";
        }
    };
    var onDeployClick = function () {
        setDeploySdl(null);
    };
    return (<components_1.Card>
      <components_1.CardHeader>
        <components_1.CardTitle className="text-2xl font-bold">Your Account</components_1.CardTitle>

        {!isAnonymousFreeTrialEnabled && isTrialing && <shared_1.TrialDeploymentBadge />}
      </components_1.CardHeader>

      <components_1.CardContent>
        {address && (<div className="flex flex-col justify-between lg:flex-row">
            {isLoadingBalances && !walletBalance && (<div className="flex h-[200px] basis-[220px] items-center justify-center">
                <components_1.Spinner size="large"/>
              </div>)}

            <div className="basis-2/5">
              <div className="flex items-center">
                {activeDeployments.length > 0 && <StatusPill_1.StatusPill state="active" style={{ marginLeft: 0 }}/>}
                <p className={(0, utils_1.cn)((_b = {}, _b["ml-4"] = activeDeployments.length > 0, _b))}>
                  You have{" "}
                  <link_1.default href={urlUtils_1.UrlService.deploymentList()} passHref>
                    {activeDeployments.length} active{" "}
                    <react_intl_1.FormattedPlural value={activeDeployments.length} zero="deployment" one="deployment" other="deployments"/>
                  </link_1.default>
                </p>
              </div>

              {activeDeployments.length > 0 && (<div className="flex flex-col gap-2">
                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Total resources leased</p>

                    <div className="flex flex-col items-start">
                      <LeaseSpecDetail_1.LeaseSpecDetail type="cpu" value={totalCpu}/>
                      {!!totalGpu && <LeaseSpecDetail_1.LeaseSpecDetail type="gpu" value={totalGpu}/>}
                      <LeaseSpecDetail_1.LeaseSpecDetail type="ram" value={"".concat((0, mathHelpers_1.roundDecimal)(_ram.value, 1), " ").concat(_ram.unit)}/>
                      <LeaseSpecDetail_1.LeaseSpecDetail type="storage" value={"".concat((0, mathHelpers_1.roundDecimal)(_storage.value, 1), " ").concat(_storage.unit)}/>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Total cost</p>

                    <div className="flex items-center">
                      <p>
                        <strong>
                          <react_intl_1.FormattedNumber value={costPerMonth || 0} 
            // eslint-disable-next-line react/style-prop-object
            style="currency" currency="USD"/>
                        </strong>{" "}
                        / month
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-4 text-sm text-muted-foreground">Providers</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {userProviders === null || userProviders === void 0 ? void 0 : userProviders.map(function (p) { return (<link_1.default key={p.owner} href={p.owner ? urlUtils_1.UrlService.providerDetailLeases(p.owner) : "#"}>
                          <components_1.Badge>{p.name}</components_1.Badge>
                        </link_1.default>); })}
                    </div>
                  </div>
                </div>)}

              <div className="mt-4 flex gap-2">
                <link_1.default href={urlUtils_1.UrlService.newDeployment()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }))} onClick={onDeployClick} aria-disabled={settings.isBlockchainDown}>
                  Deploy
                  <iconoir_react_1.Rocket className="ml-2 rotate-45 text-sm"/>
                </link_1.default>
                {isManagedWallet && (<>
                    <AddFundsLink_1.AddFundsLink className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }))} href={urlUtils_1.UrlService.payment()}>
                      <span className="whitespace-nowrap">Add Funds</span>
                      <iconoir_react_1.HandCard className="ml-2 text-xs"/>
                    </AddFundsLink_1.AddFundsLink>
                  </>)}
              </div>
            </div>

            <div className="mt-4 flex basis-3/5 flex-col items-center md:mt-0 md:flex-row">
              {!!hasBalance && (<div>
                  {filteredAktData.length > 0 && <BalancePie data={filteredAktData} getColor={_getColor} label="AKT"/>}
                  {filteredUsdcData.length > 0 && <BalancePie data={filteredUsdcData} getColor={_getColor} label={isManagedWallet ? "$" : "USDC"}/>}
                </div>)}

              {walletBalance && (<div className={(0, utils_1.cn)((_c = {}, _c["p-4"] = !hasBalance, _c))} onMouseLeave={function () { return setSelectedDataId(null); }}>
                  {allData.map(function (balance, i) { return (<div className="mb-2 flex items-center text-xs leading-5 transition-opacity duration-200 ease-in-out" key={i} onMouseEnter={function () { return setSelectedDataId(balance.id); }} style={{ opacity: !selectedDataId || balance.id === selectedDataId ? 1 : 0.3 }}>
                      <div className="h-4 w-4 rounded-lg" style={{ backgroundColor: balance.color }}/>
                      <div className="ml-4 w-[90px] font-bold">{balance.label}</div>
                      {!isManagedWallet && (<div className="ml-4 w-[100px]">
                          {(0, mathHelpers_1.udenomToDenom)(balance.value, 2)} {balance.denomLabel}
                        </div>)}

                      <div>
                        <PriceValue_1.PriceValue denom={balance.denom} value={(0, mathHelpers_1.udenomToDenom)(balance.value, 6)}/>
                      </div>
                    </div>); })}

                  {!isManagedWallet && (<>
                      <div className="mb-2 flex items-center text-sm leading-5 transition-opacity duration-200 ease-in-out">
                        <div className="h-4 w-4 rounded-lg"/>
                        <div className="ml-4 w-[90px] font-bold">Total</div>
                        <div className="ml-4 w-[100px]">
                          <strong>{(0, priceUtils_1.uaktToAKT)(walletBalance.totalUAKT, 2)} AKT</strong>
                        </div>

                        <div>
                          <strong>
                            <PriceValue_1.PriceValue denom={denom_config_1.UAKT_DENOM} value={(0, priceUtils_1.uaktToAKT)(walletBalance.totalUAKT) + (0, priceUtils_1.uaktToAKT)(walletBalance.totalDeploymentGrantsUAKT)}/>
                          </strong>
                        </div>
                      </div>
                      <div className="mb-2 flex items-center text-sm leading-5 transition-opacity duration-200 ease-in-out">
                        <div className="h-4 w-4 rounded-lg"/>
                        <div className="ml-4 w-[90px] font-bold"></div>
                        <div className="ml-4 w-[100px]">
                          <strong>{(0, mathHelpers_1.udenomToDenom)(walletBalance.totalUUSDC, 2)} USDC</strong>
                        </div>

                        <div>
                          <strong>
                            <PriceValue_1.PriceValue denom={usdcIbcDenom} value={(0, mathHelpers_1.udenomToDenom)(walletBalance.totalUUSDC + walletBalance.totalDeploymentGrantsUUSDC)}/>
                          </strong>
                        </div>
                      </div>
                    </>)}

                  <div className="mb-2 mt-2 flex items-center border-t border-muted-foreground pt-2 text-sm leading-5 transition-opacity duration-200 ease-in-out">
                    <div className="h-4 w-4 rounded-lg"/>
                    <div className="ml-4 w-[90px] font-bold"></div>
                    {!isManagedWallet && <div className="ml-4 w-[100px]"></div>}

                    <div>
                      <strong>
                        <react_intl_1.FormattedNumber value={walletBalance.totalUsd} 
            // eslint-disable-next-line react/style-prop-object
            style="currency" currency="USD"/>
                      </strong>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>)}

        {!address && <ConnectWallet_1.ConnectWallet text="Setup your billing to deploy!"/>}
      </components_1.CardContent>
    </components_1.Card>);
};
exports.YourAccount = YourAccount;
var BalancePie = function (_a) {
    var label = _a.label, data = _a.data, getColor = _a.getColor;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    return (<div className="flex h-[200px] w-[220px] items-center justify-center">
      <pie_1.ResponsivePie data={data} margin={{ top: 15, right: 15, bottom: 15, left: 0 }} innerRadius={0.4} padAngle={2} cornerRadius={4} activeOuterRadiusOffset={8} colors={getColor} borderWidth={0} borderColor={{
            from: "color",
            modifiers: [["darker", 0.2]]
        }} valueFormat={function (value) {
            return "".concat((0, mathHelpers_1.udenomToDenom)(value, 2), " ").concat(label);
        }} tooltip={function (value) { return (<div className="flex items-center rounded bg-muted px-2 py-1">
            <div className="h-2 w-2" style={{ backgroundColor: value.datum.color }}/>
            <div className="ml-2">
              {value.datum.label}: {value.datum.formattedValue}
            </div>
          </div>); }} enableArcLinkLabels={false} arcLabelsSkipAngle={10} theme={{
            // background: theme === "dark" ? lighten(theme.palette.background.paper, 0.0525) : theme.palette.background.paper,
            text: {
                fill: "#fff",
                fontSize: 12
            },
            tooltip: {
                basic: {
                    color: resolvedTheme === "dark" ? "#fff" : colors_1.customColors.main
                },
                container: {
                    backgroundColor: resolvedTheme === "dark" ? colors_1.customColors.main : "#fff"
                }
            }
        }}/>
    </div>);
};
exports.default = exports.YourAccount;
