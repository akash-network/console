"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDenomData = exports.useWalletBalance = exports.TX_FEE_BUFFER = void 0;
var react_1 = require("react");
var jotai_1 = require("jotai");
var denom_config_1 = require("@src/config/denom.config");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var PricingProvider_1 = require("@src/context/PricingProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useBalancesQuery_1 = require("@src/queries/useBalancesQuery");
var walletStore_1 = require("@src/store/walletStore");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var useDenom_1 = require("./useDenom");
exports.TX_FEE_BUFFER = 10000;
var useWalletBalance = function () {
    var _a = (0, PricingProvider_1.usePricing)(), isLoaded = _a.isLoaded, price = _a.price, udenomToUsd = _a.udenomToUsd;
    var _b = (0, WalletProvider_1.useWallet)(), address = _b.address, isManaged = _b.isManaged;
    var _c = (0, useBalancesQuery_1.useBalances)(address), balances = _c.data, isLoadingBalances = _c.isFetching, refetch = _c.refetch;
    var _d = (0, jotai_1.useAtom)(walletStore_1.default.balance), walletBalance = _d[0], setWalletBalance = _d[1];
    (0, react_1.useEffect)(function () {
        if (isLoaded && balances && price) {
            var aktUsdValue = (0, priceUtils_1.uaktToAKT)(balances.balanceUAKT, 6) * price;
            var totalUsdcValue = (0, mathHelpers_1.udenomToDenom)(balances.balanceUUSDC, 6);
            var totalDeploymentEscrowUSD = balances.activeDeployments.reduce(function (acc, d) { return acc + d.escrowAccount.state.funds.reduce(function (fundAcc, fund) { return fundAcc + udenomToUsd(fund.amount, fund.denom); }, 0); }, 0);
            var deploymentGrants = balances.deploymentGrants;
            var totalDeploymentGrantsUSD = deploymentGrants.reduce(function (sum, grant) { return sum + udenomToUsd(grant.authorization.spend_limit.amount, grant.authorization.spend_limit.denom); }, 0);
            setWalletBalance({
                totalUsd: aktUsdValue + totalUsdcValue + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
                balanceUAKT: balances.balanceUAKT + balances.deploymentGrantsUAKT,
                balanceUUSDC: balances.balanceUUSDC + balances.deploymentGrantsUUSDC,
                totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + balances.deploymentGrantsUAKT,
                totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + balances.deploymentGrantsUUSDC,
                totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
                totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
                totalDeploymentEscrowUSD: totalDeploymentEscrowUSD,
                totalDeploymentGrantsUAKT: balances.deploymentGrantsUAKT,
                totalDeploymentGrantsUUSDC: balances.deploymentEscrowUAKT,
                totalDeploymentGrantsUSD: totalDeploymentGrantsUSD
            });
        }
    }, [isLoaded, price, balances, isManaged, udenomToUsd]);
    return {
        balance: walletBalance,
        isLoading: isLoadingBalances,
        refetch: refetch
    };
};
exports.useWalletBalance = useWalletBalance;
var useDenomData = function (denom) {
    var _a = (0, PricingProvider_1.usePricing)(), isLoaded = _a.isLoaded, price = _a.price, aktToUSD = _a.aktToUSD;
    var walletBalance = (0, exports.useWalletBalance)().balance;
    var _b = (0, react_1.useState)(null), depositData = _b[0], setDepositData = _b[1];
    var usdcIbcDenom = (0, useDenom_1.useUsdcDenom)();
    var minDeposit = (0, ChainParamProvider_1.useChainParam)().minDeposit;
    var isManaged = (0, WalletProvider_1.useWallet)().isManaged;
    var txFeeBuffer = isManaged ? 0 : exports.TX_FEE_BUFFER;
    (0, react_1.useEffect)(function () {
        if (isLoaded && walletBalance && ((minDeposit === null || minDeposit === void 0 ? void 0 : minDeposit.akt) || (minDeposit === null || minDeposit === void 0 ? void 0 : minDeposit.usdc)) && price) {
            var depositData_1 = null;
            switch (denom) {
                case denom_config_1.UAKT_DENOM:
                    depositData_1 = {
                        min: minDeposit.akt,
                        label: "AKT",
                        balance: (0, priceUtils_1.uaktToAKT)(walletBalance.balanceUAKT, 6),
                        max: (0, priceUtils_1.uaktToAKT)(Math.max(walletBalance.balanceUAKT - txFeeBuffer, 0), 6)
                    };
                    break;
                case usdcIbcDenom:
                    depositData_1 = {
                        min: minDeposit.usdc,
                        label: "USDC",
                        balance: (0, mathHelpers_1.udenomToDenom)(walletBalance.balanceUUSDC, 6),
                        max: (0, mathHelpers_1.udenomToDenom)(Math.max(walletBalance.balanceUUSDC - txFeeBuffer, 0), 6)
                    };
                    break;
                default:
                    break;
            }
            if (depositData_1 && isManaged) {
                depositData_1.label = "USD";
                if (denom === denom_config_1.UAKT_DENOM) {
                    depositData_1.balance = aktToUSD(depositData_1.balance) || 0;
                    depositData_1.min = aktToUSD(depositData_1.min) || 0;
                    depositData_1.max = aktToUSD(depositData_1.max) || 0;
                }
            }
            setDepositData(depositData_1);
        }
    }, [denom, isLoaded, price, walletBalance, usdcIbcDenom, minDeposit, isManaged, txFeeBuffer, aktToUSD]);
    return depositData;
};
exports.useDenomData = useDenomData;
