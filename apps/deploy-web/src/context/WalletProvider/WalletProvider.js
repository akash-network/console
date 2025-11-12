"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
exports.WalletProvider = exports.WalletProviderContext = void 0;
exports.useWallet = useWallet;
exports.useIsManagedWalletUser = useIsManagedWalletUser;
var react_1 = require("react");
var http_sdk_1 = require("@akashnetwork/http-sdk");
var components_1 = require("@akashnetwork/ui/components");
var react_2 = require("@cosmos-kit/react");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var notistack_1 = require("notistack");
var TransactionModal_1 = require("@src/components/layout/TransactionModal");
var browser_env_config_1 = require("@src/config/browser-env.config");
var useAllowance_1 = require("@src/hooks/useAllowance");
var useManagedWallet_1 = require("@src/hooks/useManagedWallet");
var useUser_1 = require("@src/hooks/useUser");
var useWhen_1 = require("@src/hooks/useWhen");
var useBalancesQuery_1 = require("@src/queries/useBalancesQuery");
var networkStore_1 = require("@src/store/networkStore");
var walletStore_1 = require("@src/store/walletStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var walletUtils_1 = require("@src/utils/walletUtils");
var CustomChainProvider_1 = require("../CustomChainProvider");
var ServicesProvider_1 = require("../ServicesProvider");
var SettingsProvider_1 = require("../SettingsProvider");
var settingsStore_1 = require("../SettingsProvider/settingsStore");
var ERROR_MESSAGES = {
    5: "Insufficient funds",
    9: "Unknown address",
    11: "Out of gas",
    12: "Memo too large",
    13: "Insufficient fee",
    19: "Tx already in mempool",
    25: "Invalid gas adjustment"
};
/**
 * @private for testing only
 */
exports.WalletProviderContext = react_1.default.createContext({});
var MESSAGE_STATES = {
    "/akash.deployment.v1beta4.MsgCloseDeployment": "closingDeployment",
    "/akash.deployment.v1beta4.MsgCreateDeployment": "searchingProviders",
    "/akash.market.v1beta5.MsgCreateLease": "creatingDeployment",
    "/akash.deployment.v1beta4.MsgUpdateDeployment": "updatingDeployment",
    "/akash.escrow.v1.MsgAccountDeposit": "depositingDeployment"
};
/**
 * WalletProvider is a client only component
 */
var WalletProvider = function (_a) {
    var children = _a.children;
    var _b = (0, ServicesProvider_1.useServices)(), analyticsService = _b.analyticsService, txHttpService = _b.tx;
    var _c = (0, jotai_1.useAtom)(settingsStore_1.settingsIdAtom), setSettingsId = _c[1];
    var _d = (0, react_1.useState)(true), isWalletLoaded = _d[0], setIsWalletLoaded = _d[1];
    var _e = (0, react_1.useState)(undefined), loadingState = _e[0], setLoadingState = _e[1];
    var _f = (0, notistack_1.useSnackbar)(), enqueueSnackbar = _f.enqueueSnackbar, closeSnackbar = _f.closeSnackbar;
    var router = (0, navigation_1.useRouter)();
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var user = (0, useUser_1.useUser)().user;
    var userWallet = (0, CustomChainProvider_1.useSelectedChain)();
    var _g = (0, useManagedWallet_1.useManagedWallet)(), managedWallet = _g.wallet, isManagedWalletLoading = _g.isLoading, createManagedWallet = _g.create, managedWalletError = _g.createError;
    var _h = (0, jotai_1.useAtom)(walletStore_1.default.isWalletModalOpen), setIsWalletModelOpen = _h[1];
    var _j = (0, jotai_1.useAtom)(walletStore_1.default.selectedWalletType), selectedWalletType = _j[0], setSelectedWalletType = _j[1];
    var _k = (0, react_1.useMemo)(function () { return (selectedWalletType === "managed" && managedWallet) || userWallet; }, [managedWallet, userWallet, selectedWalletType]), walletAddress = _k.address, username = _k.username, isWalletConnected = _k.isWalletConnected;
    var refetchBalances = (0, useBalancesQuery_1.useBalances)(walletAddress).refetch;
    var addEndpoints = (0, react_2.useManager)().addEndpoints;
    var isManaged = (0, react_1.useMemo)(function () { return !!managedWallet && (managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.address) === walletAddress; }, [walletAddress, managedWallet]);
    var feeGranter = (0, useAllowance_1.useAllowance)(walletAddress, isManaged).fee.default;
    var _l = networkStore_1.default.useSelectedNetworkIdStore(), selectedNetworkId = _l[0], setSelectedNetworkId = _l[1];
    var isLoading = (selectedWalletType === "managed" && isManagedWalletLoading) || (selectedWalletType === "custodial" && userWallet.isWalletConnecting);
    (0, useWhen_1.useWhen)(walletAddress, loadWallet);
    (0, useWhen_1.useWhen)(isWalletConnected && selectedWalletType, function () {
        if (selectedWalletType === "custodial") {
            analyticsService.track("connect_wallet", {
                category: "wallet",
                label: "Connect wallet"
            }, "GA");
            analyticsService.identify({ custodialWallet: true });
            analyticsService.trackSwitch("connect_wallet", "custodial", "Amplitude");
        }
        else if (selectedWalletType === "managed") {
            analyticsService.identify({ managedWallet: true });
            analyticsService.trackSwitch("connect_wallet", "managed", "Amplitude");
        }
    });
    (0, react_1.useEffect)(function () {
        if (!settings.apiEndpoint || !settings.rpcEndpoint)
            return;
        addEndpoints({
            akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
            "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
            "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
        });
    }, [addEndpoints, settings.apiEndpoint, settings.rpcEndpoint]);
    (0, react_1.useEffect)(function () {
        setSettingsId(walletAddress || null);
    }, [walletAddress]);
    function switchWalletType() {
        if (selectedWalletType === "custodial" && !managedWallet) {
            userWallet.disconnect();
        }
        if (selectedWalletType === "managed" && !userWallet.isWalletConnected) {
            setIsWalletModelOpen(true);
            userWallet.connect();
        }
        if (selectedWalletType === "managed" && managedWallet) {
            (0, walletUtils_1.updateStorageManagedWallet)(__assign(__assign({}, managedWallet), { selected: false }));
        }
        setSelectedWalletType(function (prev) { return (prev === "custodial" ? "managed" : "custodial"); });
    }
    function connectManagedWallet() {
        if (!managedWallet) {
            createManagedWallet();
        }
        setSelectedWalletType("managed");
    }
    function logout() {
        userWallet.disconnect();
        analyticsService.track("disconnect_wallet", {
            category: "wallet",
            label: "Disconnect wallet"
        });
        router.push(urlUtils_1.UrlService.home());
        if (managedWallet) {
            setSelectedWalletType("managed");
        }
    }
    function loadWallet() {
        return __awaiter(this, void 0, void 0, function () {
            var networkId, currentWallets;
            return __generator(this, function (_a) {
                networkId = isManaged && selectedNetworkId !== browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID
                    ? browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID
                    : undefined;
                currentWallets = (0, walletUtils_1.getStorageWallets)(networkId);
                if (!currentWallets.some(function (x) { return x.address === walletAddress; })) {
                    currentWallets = __spreadArray(__spreadArray([], currentWallets, true), [{ name: username || "", address: walletAddress, selected: true, isManaged: false }], false);
                }
                currentWallets = currentWallets.map(function (x) { return (__assign(__assign({}, x), { selected: x.address === walletAddress })); });
                (0, walletUtils_1.updateStorageWallets)(currentWallets, networkId);
                setIsWalletLoaded(true);
                if (networkId) {
                    setSelectedNetworkId(networkId);
                }
                return [2 /*return*/];
            });
        });
    }
    function signAndBroadcastTx(msgs) {
        return __awaiter(this, void 0, void 0, function () {
            var pendingSnackbarKey, txResult, mainMessage, enqueueTxSnackbar, estimatedFees, txRaw, err_1, _a, title, message, transactionHash, errorMsg, reg, match, log, code, codeSpace;
            var _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        pendingSnackbarKey = null;
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 8, 9, 10]);
                        if (!(!!(user === null || user === void 0 ? void 0 : user.id) && isManaged)) return [3 /*break*/, 3];
                        mainMessage = msgs.find(function (msg) { return msg.typeUrl in MESSAGE_STATES; });
                        if (mainMessage) {
                            setLoadingState(MESSAGE_STATES[mainMessage.typeUrl]);
                        }
                        return [4 /*yield*/, txHttpService.signAndBroadcastTx({ userId: user.id, messages: msgs })];
                    case 2:
                        txResult = _h.sent();
                        return [3 /*break*/, 7];
                    case 3:
                        enqueueTxSnackbar = function () {
                            pendingSnackbarKey = enqueueSnackbar(<components_1.Snackbar title="Broadcasting transaction..." subTitle="Please wait a few seconds" showLoading/>, {
                                variant: "info",
                                autoHideDuration: null
                            });
                        };
                        setLoadingState("waitingForApproval");
                        return [4 /*yield*/, userWallet.estimateFee(msgs)];
                    case 4:
                        estimatedFees = _h.sent();
                        return [4 /*yield*/, userWallet.sign(msgs, __assign(__assign({}, estimatedFees), { granter: feeGranter }))];
                    case 5:
                        txRaw = _h.sent();
                        setLoadingState("broadcasting");
                        enqueueTxSnackbar();
                        return [4 /*yield*/, userWallet.broadcast(txRaw)];
                    case 6:
                        txResult = _h.sent();
                        setLoadingState(undefined);
                        _h.label = 7;
                    case 7:
                        if (txResult.code !== 0) {
                            throw new Error(txResult.rawLog);
                        }
                        if (!managedWallet) {
                            showTransactionSnackbar("Transaction success!", "", txResult.transactionHash, "success");
                        }
                        analyticsService.track("successful_tx", {
                            category: "transactions",
                            label: "Successful transaction"
                        });
                        return [2 /*return*/, true];
                    case 8:
                        err_1 = _h.sent();
                        console.error(err_1);
                        if ((0, http_sdk_1.isHttpError)(err_1) && ((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.status) !== 500) {
                            _a = (_f = (_e = (_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.split(": ")) !== null && _f !== void 0 ? _f : [], title = _a[0], message = _a[1];
                            showTransactionSnackbar(title || message || "Error", message, "", "error");
                        }
                        else {
                            transactionHash = err_1.txHash;
                            errorMsg = "An error has occured";
                            if ((_g = err_1.message) === null || _g === void 0 ? void 0 : _g.includes("was submitted but was not yet found on the chain")) {
                                errorMsg = "Transaction timeout";
                            }
                            else if (err_1.message) {
                                try {
                                    reg = /Broadcasting transaction failed with code (.+?) \(codespace: (.+?)\)/i;
                                    match = err_1.message.match(reg);
                                    log = err_1.message.substring(err_1.message.indexOf("Log"), err_1.message.length);
                                    if (match) {
                                        code = parseInt(match[1]);
                                        codeSpace = match[2];
                                        if (codeSpace === "sdk" && code in ERROR_MESSAGES) {
                                            errorMsg = ERROR_MESSAGES[code];
                                        }
                                    }
                                    if (log) {
                                        errorMsg += ". ".concat(log);
                                    }
                                }
                                catch (err) {
                                    console.error(err);
                                }
                            }
                            if (!errorMsg.includes("Request rejected")) {
                                analyticsService.track("failed_tx", {
                                    category: "transactions",
                                    label: "Failed transaction"
                                });
                            }
                            showTransactionSnackbar("Transaction has failed...", errorMsg, transactionHash, "error");
                        }
                        return [2 /*return*/, false];
                    case 9:
                        refetchBalances();
                        if (pendingSnackbarKey) {
                            closeSnackbar(pendingSnackbarKey);
                        }
                        setLoadingState(undefined);
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    }
    var showTransactionSnackbar = function (snackTitle, snackMessage, transactionHash, snackVariant) {
        enqueueSnackbar(<components_1.Snackbar title={snackTitle} subTitle={<TransactionSnackbarContent snackMessage={snackMessage} transactionHash={transactionHash}/>} iconVariant={snackVariant}/>, {
            variant: snackVariant,
            autoHideDuration: 10000
        });
    };
    return (<exports.WalletProviderContext.Provider value={{
            address: walletAddress,
            walletName: username,
            isWalletConnected: isWalletConnected,
            isWalletLoaded: isWalletLoaded,
            connectManagedWallet: connectManagedWallet,
            logout: logout,
            signAndBroadcastTx: signAndBroadcastTx,
            isManaged: isManaged,
            isCustodial: !isManaged,
            isWalletLoading: isLoading,
            isTrialing: isManaged && !!(managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.isTrialing),
            isOnboarding: !!(user === null || user === void 0 ? void 0 : user.userId) && isManaged && !!(managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.isTrialing),
            creditAmount: isManaged ? managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.creditAmount : 0,
            hasManagedWallet: !!managedWallet,
            managedWalletError: managedWalletError,
            switchWalletType: switchWalletType
        }}>
      {children}

      <TransactionModal_1.TransactionModal state={loadingState}/>
    </exports.WalletProviderContext.Provider>);
};
exports.WalletProvider = WalletProvider;
// Hook
function useWallet() {
    return __assign({}, react_1.default.useContext(exports.WalletProviderContext));
}
function useIsManagedWalletUser() {
    var _a = useWallet(), canVisit = _a.isManaged, isLoading = _a.isWalletLoading;
    return { canVisit: canVisit, isLoading: isLoading };
}
var TransactionSnackbarContent = function (_a) {
    var snackMessage = _a.snackMessage, transactionHash = _a.transactionHash;
    var selectedNetworkId = networkStore_1.default.useSelectedNetworkId();
    var txUrl = transactionHash && "".concat(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_STATS_APP_URL, "/transactions/").concat(transactionHash, "?network=").concat(selectedNetworkId);
    return (<>
      {snackMessage}
      {snackMessage && <br />}
      {txUrl && (<link_1.default href={txUrl} target="_blank" className="inline-flex items-center space-x-2 !text-white">
          <span>View transaction</span>
          <iconoir_react_1.OpenNewWindow className="text-xs"/>
        </link_1.default>)}
    </>);
};
