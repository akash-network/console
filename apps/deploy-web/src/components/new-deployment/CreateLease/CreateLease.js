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
exports.CreateLease = exports.DEPENDENCIES = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var axios_1 = require("axios");
var iconoir_react_1 = require("iconoir-react");
var js_yaml_1 = require("js-yaml");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var notistack_1 = require("notistack");
var SignUpButton_1 = require("@src/components/auth/SignUpButton/SignUpButton");
var AddFundsLink_1 = require("@src/components/user/AddFundsLink");
var browser_env_config_1 = require("@src/config/browser-env.config");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useManagedDeploymentConfirm_1 = require("@src/hooks/useManagedDeploymentConfirm");
var useWhen_1 = require("@src/hooks/useWhen");
var useBidQuery_1 = require("@src/queries/useBidQuery");
var useBlocksQuery_1 = require("@src/queries/useBlocksQuery");
var useDeploymentQuery_1 = require("@src/queries/useDeploymentQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var route_steps_type_1 = require("@src/types/route-steps.type");
var deploymentData_1 = require("@src/utils/deploymentData");
var v1beta3_1 = require("@src/utils/deploymentData/v1beta3");
var domUtils_1 = require("@src/utils/domUtils");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var CertificateProvider_1 = require("../../../context/CertificateProvider");
var LocalNoteProvider_1 = require("../../../context/LocalNoteProvider");
var CustomDropdownLinkItem_1 = require("../../shared/CustomDropdownLinkItem");
var CustomNextSeo_1 = require("../../shared/CustomNextSeo");
var LinearLoadingSkeleton_1 = require("../../shared/LinearLoadingSkeleton");
var ManifestErrorSnackbar_1 = require("../../shared/ManifestErrorSnackbar");
var ViewPanel_1 = require("../../shared/ViewPanel");
var BidCountdownTimer_1 = require("../BidCountdownTimer");
var BidGroup_1 = require("../BidGroup");
exports.DEPENDENCIES = {
    Alert: components_1.Alert,
    Button: components_1.Button,
    Card: components_1.Card,
    CardContent: components_1.CardContent,
    Checkbox: components_1.Checkbox,
    CustomTooltip: components_1.CustomTooltip,
    DropdownMenu: components_1.DropdownMenu,
    DropdownMenuContent: components_1.DropdownMenuContent,
    DropdownMenuTrigger: components_1.DropdownMenuTrigger,
    Input: components_1.Input,
    Snackbar: components_1.Snackbar,
    Spinner: components_1.Spinner,
    CustomNextSeo: CustomNextSeo_1.CustomNextSeo,
    CustomDropdownLinkItem: CustomDropdownLinkItem_1.CustomDropdownLinkItem,
    BadgeCheck: iconoir_react_1.BadgeCheck,
    InfoCircle: iconoir_react_1.InfoCircle,
    LinearLoadingSkeleton: LinearLoadingSkeleton_1.LinearLoadingSkeleton,
    ViewPanel: ViewPanel_1.default,
    BidGroup: BidGroup_1.BidGroup,
    BidCountdownTimer: BidCountdownTimer_1.BidCountdownTimer,
    AlertTitle: components_1.AlertTitle,
    AlertDescription: components_1.AlertDescription,
    SignUpButton: SignUpButton_1.SignUpButton,
    AddFundsLink: AddFundsLink_1.AddFundsLink,
    useServices: ServicesProvider_1.useServices,
    useWallet: WalletProvider_1.useWallet,
    useCertificate: CertificateProvider_1.useCertificate,
    useLocalNotes: LocalNoteProvider_1.useLocalNotes,
    useProviderList: useProvidersQuery_1.useProviderList,
    useBidList: useBidQuery_1.useBidList,
    useDeploymentDetail: useDeploymentQuery_1.useDeploymentDetail,
    useMuiTheme: styles_1.useTheme,
    useMediaQuery: useMediaQuery_1.default,
    useSnackbar: notistack_1.useSnackbar,
    useManagedDeploymentConfirm: useManagedDeploymentConfirm_1.useManagedDeploymentConfirm,
    useRouter: navigation_1.useRouter,
    useBlock: useBlocksQuery_1.useBlock,
    useSettings: SettingsProvider_1.useSettings,
    useFlag: useFlag_1.useFlag
};
// Refresh bids every 7 seconds;
var REFRESH_BIDS_INTERVAL = 7000;
// Request every 7 seconds to a max of 5.5 minutes before deployments closes
var MAX_NUM_OF_BID_REQUESTS = Math.floor((5.5 * 60 * 1000) / REFRESH_BIDS_INTERVAL);
// Show a warning after 1 minute
var WARNING_NUM_OF_BID_REQUESTS = Math.round((60 * 1000) / REFRESH_BIDS_INTERVAL);
var TRIAL_SIGNUP_WARNING_TIMEOUT = 33000;
var CreateLease = function (_a) {
    var dseq = _a.dseq, _b = _a.dependencies, d = _b === void 0 ? exports.DEPENDENCIES : _b;
    var settings = d.useSettings().settings;
    var _c = d.useServices(), providerProxy = _c.providerProxy, analyticsService = _c.analyticsService, errorHandler = _c.errorHandler, networkStore = _c.networkStore, urlService = _c.urlService, deploymentLocalStorage = _c.deploymentLocalStorage;
    var _d = (0, react_1.useState)(false), isSendingManifest = _d[0], setIsSendingManifest = _d[1];
    var _e = (0, react_1.useState)(false), isFilteringFavorites = _e[0], setIsFilteringFavorites = _e[1];
    var _f = (0, react_1.useState)(false), isFilteringAudited = _f[0], setIsFilteringAudited = _f[1];
    var _g = (0, react_1.useState)(false), isCreatingLeases = _g[0], setIsCreatingLeases = _g[1];
    var _h = (0, react_1.useState)({}), selectedBids = _h[0], setSelectedBids = _h[1];
    var _j = (0, react_1.useState)([]), filteredBids = _j[0], setFilteredBids = _j[1];
    var _k = (0, react_1.useState)(""), search = _k[0], setSearch = _k[1];
    var _l = d.useWallet(), address = _l.address, signAndBroadcastTx = _l.signAndBroadcastTx, isManaged = _l.isManaged, isTrialing = _l.isTrialing;
    var isAnonymousFreeTrialEnabled = d.useFlag("anonymous_free_trial");
    var _m = d.useCertificate(), localCert = _m.localCert, setLocalCert = _m.setLocalCert, genNewCertificateIfLocalIsInvalid = _m.genNewCertificateIfLocalIsInvalid, updateSelectedCertificate = _m.updateSelectedCertificate;
    var router = d.useRouter();
    var _o = (0, react_1.useState)(0), numberOfRequests = _o[0], setNumberOfRequests = _o[1];
    var providers = d.useProviderList().data;
    var warningRequestsReached = numberOfRequests > WARNING_NUM_OF_BID_REQUESTS;
    var maxRequestsReached = numberOfRequests > MAX_NUM_OF_BID_REQUESTS;
    var favoriteProviders = d.useLocalNotes().favoriteProviders;
    var _p = d.useBidList(address, dseq, {
        initialData: [],
        refetchInterval: REFRESH_BIDS_INTERVAL,
        enabled: !maxRequestsReached && !isSendingManifest
    }), bids = _p.data, isLoadingBids = _p.isLoading, bidsUpdatedAt = _p.dataUpdatedAt;
    (0, react_1.useEffect)(function () {
        setNumberOfRequests(function (prev) { return ++prev; });
    }, [bidsUpdatedAt]);
    var activeBid = (0, react_1.useMemo)(function () { return bids === null || bids === void 0 ? void 0 : bids.find(function (bid) { return bid.state === "active"; }); }, [bids]);
    var hasActiveBid = !!activeBid;
    var _q = d.useDeploymentDetail(address, dseq, { refetchOnMount: false, enabled: false }), deploymentDetail = _q.data, getDeploymentDetail = _q.refetch;
    var groupedBids = (bids === null || bids === void 0 ? void 0 : bids.sort(function (a, b) { return parseFloat(a.price.amount) - parseFloat(b.price.amount); }).reduce(function (a, b) {
        a[b.gseq] = __spreadArray(__spreadArray([], (a[b.gseq] || []), true), [b], false);
        return a;
    }, {})) || {};
    var dseqList = Object.keys(groupedBids).map(function (group) { return parseInt(group); });
    var muiTheme = d.useMuiTheme();
    var smallScreen = d.useMediaQuery(muiTheme.breakpoints.down("md"));
    var allClosed = ((bids === null || bids === void 0 ? void 0 : bids.length) || 0) > 0 && (bids === null || bids === void 0 ? void 0 : bids.every(function (bid) { return bid.state === "closed"; }));
    var _r = d.useSnackbar(), enqueueSnackbar = _r.enqueueSnackbar, closeSnackbar = _r.closeSnackbar;
    var closeDeploymentConfirm = d.useManagedDeploymentConfirm().closeDeploymentConfirm;
    (0, react_1.useEffect)(function () {
        getDeploymentDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, useWhen_1.useWhen)(hasActiveBid, function () {
        if (activeBid) {
            selectBid(activeBid);
        }
    });
    var chainNetwork = networkStore.useSelectedNetworkId();
    var sendManifest = (0, react_1.useCallback)(function (cert) { return __awaiter(void 0, void 0, void 0, function () {
        var bidKeys, localDeploymentData, sendManifestNotification, yamlJson, mani, options, _loop_1, i, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setIsSendingManifest(true);
                    bidKeys = Object.keys(selectedBids);
                    localDeploymentData = deploymentLocalStorage.get(address, dseq);
                    analyticsService.track("send_manifest", {
                        category: "deployments",
                        label: "Send manifest after creating lease"
                    });
                    if (!localDeploymentData || !localDeploymentData.manifest) {
                        return [2 /*return*/];
                    }
                    sendManifestNotification = !isManaged &&
                        enqueueSnackbar(<components_1.Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading/>, {
                            variant: "info",
                            autoHideDuration: null
                        });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    yamlJson = js_yaml_1.default.load(localDeploymentData.manifest);
                    mani = deploymentData_1.deploymentData.getManifest(yamlJson, true);
                    options = {
                        dseq: dseq,
                        credentials: {
                            type: "mtls",
                            value: {
                                cert: cert.certPem,
                                key: cert.keyPem
                            }
                        },
                        chainNetwork: chainNetwork
                    };
                    _loop_1 = function (i) {
                        var currentBid, provider;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    currentBid = selectedBids[bidKeys[i]];
                                    provider = providers === null || providers === void 0 ? void 0 : providers.find(function (x) { return x.owner === currentBid.provider; });
                                    if (!provider) {
                                        throw new Error("Cannot find bid provider");
                                    }
                                    return [4 /*yield*/, providerProxy.sendManifest(provider, mani, options)];
                                case 1:
                                    _c.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < bidKeys.length)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(i)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5:
                    // Ad tracking script
                    browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_TRACKING_ENABLED &&
                        browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED &&
                        (0, domUtils_1.addScriptToHead)({
                            src: "https://pxl.growth-channel.net/s/76250b26-c260-4776-874b-471ed290230d",
                            async: true,
                            defer: true,
                            id: "growth-channel-script-lease"
                        });
                    router.replace(urlUtils_1.UrlService.deploymentDetails(dseq, "EVENTS", "events"));
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _b.sent();
                    if ((0, axios_1.isAxiosError)(error_1) && ((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                        setLocalCert(null);
                    }
                    enqueueSnackbar(<ManifestErrorSnackbar_1.ManifestErrorSnackbar err={error_1} messages={{
                            "certPem.expired": 'Your certificate has expired while deploying. Please click "Re-send Manifest" again and we will generate a new one.'
                        }}/>, { variant: "error", autoHideDuration: null });
                    errorHandler.reportError({
                        error: error_1,
                        tags: { category: "deployments.create-lease" }
                    });
                    return [3 /*break*/, 8];
                case 7:
                    if (sendManifestNotification) {
                        closeSnackbar(sendManifestNotification);
                    }
                    setIsSendingManifest(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [selectedBids, dseq, providers, isManaged, enqueueSnackbar, closeSnackbar, router, chainNetwork, address, deploymentLocalStorage]);
    // Filter bids
    (0, react_1.useEffect)(function () {
        if ((search || isFilteringFavorites || isFilteringAudited) && providers) {
            var filteredBids_1 = __spreadArray([], (bids || []), true);
            if (search) {
                filteredBids_1 = filteredBids_1.filter(function (bid) {
                    var provider = providers === null || providers === void 0 ? void 0 : providers.find(function (p) { return p.owner === bid.provider; });
                    return (provider === null || provider === void 0 ? void 0 : provider.attributes.some(function (att) { var _a; return (_a = att.value) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(search.toLowerCase()); })) || (provider === null || provider === void 0 ? void 0 : provider.hostUri.includes(search));
                });
            }
            if (isFilteringFavorites) {
                filteredBids_1 = filteredBids_1.filter(function (bid) { return favoriteProviders.some(function (y) { return y === bid.provider; }); });
            }
            if (isFilteringAudited) {
                filteredBids_1 = filteredBids_1.filter(function (bid) { return !!providers.filter(function (x) { return x.isAudited; }).find(function (p) { return p.owner === bid.provider; }); });
            }
            setFilteredBids(filteredBids_1.map(function (bid) { return bid.id; }));
        }
        else {
            setFilteredBids((bids === null || bids === void 0 ? void 0 : bids.map(function (bid) { return bid.id; })) || []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, bids, providers, isFilteringFavorites, isFilteringAudited, favoriteProviders]);
    var _s = (0, react_1.useState)(false), zeroBidsForTrialWarningDisplayed = _s[0], setZeroBidsForTrialWarningDisplayed = _s[1];
    var block = d.useBlock(dseq).data;
    (0, react_1.useEffect)(function () {
        if (!isAnonymousFreeTrialEnabled || !isTrialing || numberOfRequests === 0 || (bids && bids.length > 0)) {
            setZeroBidsForTrialWarningDisplayed(false);
            return;
        }
        var timerId = setTimeout(function () {
            if (block) {
                var blockTime = new Date(block.block.header.time).getTime();
                setZeroBidsForTrialWarningDisplayed(Date.now() - blockTime > TRIAL_SIGNUP_WARNING_TIMEOUT);
            }
        }, 1000);
        return function () { return clearTimeout(timerId); };
    }, [block, bids, isTrialing, numberOfRequests, isAnonymousFreeTrialEnabled]);
    var selectBid = function (bid) {
        setSelectedBids(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[bid.gseq] = bid, _a)));
        });
    };
    /**
     * Create the leases
     */
    function createLease() {
        return __awaiter(this, void 0, void 0, function () {
            var messages, newCert, response, newLocalCert, _a, message;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setIsCreatingLeases(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 11, 12]);
                        messages = hasActiveBid ? [] : Object.values(selectedBids).map(function (bid) { return TransactionMessageData_1.TransactionMessageData.getCreateLeaseMsg(bid); });
                        return [4 /*yield*/, genNewCertificateIfLocalIsInvalid()];
                    case 2:
                        newCert = _b.sent();
                        if (newCert) {
                            messages.push(TransactionMessageData_1.TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
                        }
                        if (!(messages.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, signAndBroadcastTx(__spreadArray([], messages, true))];
                    case 3:
                        response = _b.sent();
                        if (!response)
                            return [2 /*return*/];
                        _b.label = 4;
                    case 4:
                        if (!newCert) return [3 /*break*/, 6];
                        return [4 /*yield*/, updateSelectedCertificate(newCert)];
                    case 5:
                        _a = _b.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _a = localCert;
                        _b.label = 7;
                    case 7:
                        newLocalCert = _a;
                        analyticsService.track("create_lease", {
                            category: "deployments",
                            label: "Create lease"
                        });
                        if (!newLocalCert) return [3 /*break*/, 9];
                        return [4 /*yield*/, sendManifest(newLocalCert)];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        message = "Looks like your certificate has been expired. Please click \"Re-send Manifest\" and we will generate a new one.";
                        enqueueSnackbar(<components_1.Snackbar title="Error" subTitle={message} iconVariant="error"/>, { variant: "error", autoHideDuration: null });
                        _b.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        setIsCreatingLeases(false);
                        return [7 /*endfinally*/];
                    case 12: return [2 /*return*/];
                }
            });
        });
    }
    function handleCloseDeployment() {
        return __awaiter(this, void 0, void 0, function () {
            var isConfirmed, message, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        analyticsService.track("close_deployment_btn_clk", "Amplitude");
                        return [4 /*yield*/, closeDeploymentConfirm([dseq])];
                    case 1:
                        isConfirmed = _a.sent();
                        if (!isConfirmed) {
                            return [2 /*return*/];
                        }
                        message = TransactionMessageData_1.TransactionMessageData.getCloseDeploymentMsg(address, dseq);
                        return [4 /*yield*/, signAndBroadcastTx([message])];
                    case 2:
                        response = _a.sent();
                        if (response) {
                            router.replace(urlUtils_1.UrlService.deploymentList());
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    var onSearchChange = function (event) {
        var value = event.target.value;
        setSearch(value);
    };
    var trialProviderCount = (0, react_1.useMemo)(function () {
        if (providers) {
            return providers.filter(function (provider) {
                return provider.attributes.some(function (attribute) {
                    return attribute.key === v1beta3_1.TRIAL_ATTRIBUTE && attribute.value === "true";
                });
            }).length;
        }
        return 0;
    }, [providers]);
    return (<>
      <d.CustomNextSeo title="Create Deployment - Create Lease" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.createLeases }))}/>

      <div className="mt-4">
        {!isLoadingBids && ((bids === null || bids === void 0 ? void 0 : bids.length) || 0) > 0 && !allClosed && (<div className="flex flex-col items-end justify-between py-2 md:flex-row">
            <div className="flex w-full flex-grow items-end md:w-auto">
              <div className="flex-grow">
                <d.Input placeholder="Search provider..." disabled={(bids === null || bids === void 0 ? void 0 : bids.length) === 0 || isSendingManifest} value={search} onChange={onSearchChange} type="text" className="w-full" label="Search provider" endIcon={search && (<components_1.Button size="icon" variant="ghost" onClick={function () { return setSearch(""); }} className="text-muted-foreground hover:bg-transparent hover:text-current">
                        <iconoir_react_1.Xmark />
                      </components_1.Button>)}/>
              </div>

              <d.DropdownMenu modal={false}>
                <d.DropdownMenuTrigger asChild>
                  <div className="mx-2">
                    <d.Button size="icon" variant="ghost">
                      <iconoir_react_1.MoreHoriz className="text-lg"/>
                    </d.Button>
                  </div>
                </d.DropdownMenuTrigger>
                <d.DropdownMenuContent>
                  <d.CustomDropdownLinkItem onClick={function () { return handleCloseDeployment(); }} icon={<iconoir_react_1.Bin />} disabled={settings.isBlockchainDown}>
                    Close Deployment
                  </d.CustomDropdownLinkItem>
                </d.DropdownMenuContent>
              </d.DropdownMenu>
            </div>

            <div className="flex w-full items-center py-2 md:w-auto md:py-0">
              <d.Button variant="default" color="secondary" onClick={createLease} className="w-full whitespace-nowrap md:w-auto" disabled={settings.isBlockchainDown || isSendingManifest || isCreatingLeases || (!hasActiveBid && dseqList.some(function (gseq) { return !selectedBids[gseq]; }))} data-testid="create-lease-button">
                {isCreatingLeases || isSendingManifest ? (<d.Spinner size="small"/>) : (<>
                    {hasActiveBid ? "Re-send Manifest" : "Accept Bid"}
                    {dseqList.length > 1 ? "s" : ""}
                    <span className="ml-2 flex items-center">
                      <iconoir_react_1.ArrowRight className="text-xs"/>
                    </span>
                  </>)}
              </d.Button>
            </div>
          </div>)}

        {settings.isBlockchainDown && (<div className="pt-4">
            <d.Alert variant="warning">Blockchain is unavailable. Please try to refresh the page or try again later.</d.Alert>
          </div>)}

        {!settings.isBlockchainDown && !isLoadingBids && allClosed && (<d.Button variant="default" color="secondary" onClick={handleCloseDeployment} size="sm" disabled={settings.isBlockchainDown}>
            Close Deployment
          </d.Button>)}

        {!settings.isBlockchainDown && !zeroBidsForTrialWarningDisplayed && warningRequestsReached && !maxRequestsReached && ((bids === null || bids === void 0 ? void 0 : bids.length) || 0) === 0 && (<div className="pt-4">
            <d.Alert variant="warning">
              There should be bids by now... You can wait longer in case a bid shows up or close the deployment and try again with a different configuration.
              <div className="pt-4">
                <d.Button variant="default" color="secondary" onClick={handleCloseDeployment} size="sm" disabled={settings.isBlockchainDown}>
                  Close Deployment
                </d.Button>
              </div>
            </d.Alert>
          </div>)}

        {!settings.isBlockchainDown &&
            (isLoadingBids || ((bids === null || bids === void 0 ? void 0 : bids.length) || 0) === 0) &&
            !maxRequestsReached &&
            !isSendingManifest &&
            !zeroBidsForTrialWarningDisplayed && (<div className="flex flex-col items-center justify-center pt-4 text-center">
              <d.Spinner size="large"/>
              <div className="pt-4">Waiting for bids...</div>
            </div>)}

        {!settings.isBlockchainDown && !zeroBidsForTrialWarningDisplayed && maxRequestsReached && ((bids === null || bids === void 0 ? void 0 : bids.length) || 0) === 0 && (<div className="pt-4">
            <d.Alert variant="warning">
              There's no bid for the current deployment. You can close the deployment and try again with a different configuration.
            </d.Alert>
          </div>)}

        {bids && bids.length > 0 && (<div className="my-1 flex flex-col items-center justify-between md:flex-row">
            <div className="flex w-full items-center md:w-auto">
              <div className="flex items-center space-x-2">
                <d.Checkbox checked={isFilteringFavorites} onCheckedChange={function (value) {
                setIsFilteringFavorites(value);
                analyticsService.track("filtered_by_favorite_providers", { value: value }, "Amplitude");
            }} id="provider-favorites"/>
                <label htmlFor="provider-favorites" className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Favorites
                </label>
              </div>

              <div className="ml-4 flex items-center space-x-2">
                <d.Checkbox checked={isFilteringAudited} onCheckedChange={function (value) {
                setIsFilteringAudited(value);
                analyticsService.track("filtered_by_audited_providers", { value: value }, "Amplitude");
            }} id="provider-audited" data-testid="create-lease-filter-audited"/>
                <label htmlFor="provider-audited" className="inline-flex cursor-pointer items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Audited
                  <d.BadgeCheck className="ml-2 text-sm text-green-600"/>
                </label>
              </div>

              {!isLoadingBids && allClosed && (<div className="ml-4 flex items-center">
                  <d.CustomTooltip title={<div>
                        All bids for this deployment are closed. This can happen if no bids are accepted for more than 5 minutes after the deployment creation.
                        You can close this deployment and create a new one.
                      </div>}>
                    <d.InfoCircle className="text-xs text-red-600"/>
                  </d.CustomTooltip>
                </div>)}
            </div>

            {!isSendingManifest && (<div className="mt-2 flex items-center self-start sm:self-center md:ml-4 md:mt-0">
                <d.BidCountdownTimer height={bids && (bids === null || bids === void 0 ? void 0 : bids.length) > 0 ? bids[0].dseq : null}/>
              </div>)}

            {!maxRequestsReached && !isSendingManifest && (<div className="flex items-center self-start text-xs leading-4 sm:self-center">
                <p className="text-xs text-muted-foreground">Waiting for more bids...</p>
                <div className="ml-2">
                  <d.Spinner size="small"/>
                </div>
              </div>)}
          </div>)}
      </div>

      <d.LinearLoadingSkeleton isLoading={isSendingManifest}/>
      {dseqList.length > 0 && (<d.ViewPanel stickToBottom className="overflow-visible pb-16 md:overflow-auto" style={{ height: smallScreen ? "auto" : "" }}>
          {dseqList.map(function (gseq, i) { return (<d.BidGroup key={gseq} gseq={gseq} bids={groupedBids[gseq]} handleBidSelected={selectBid} selectedBid={selectedBids[gseq]} disabled={isSendingManifest} providers={providers} filteredBids={filteredBids} deploymentDetail={deploymentDetail} isFilteringFavorites={isFilteringFavorites} isFilteringAudited={isFilteringAudited} groupIndex={i} totalBids={dseqList.length} isSendingManifest={isSendingManifest}/>); })}

          {isTrialing && isAnonymousFreeTrialEnabled && (<d.Alert variant="destructive">
              <d.AlertTitle className="text-center text-lg dark:text-white/90">Free Trial!</d.AlertTitle>
              <d.AlertDescription className="space-y-1 text-center dark:text-white/90">
                <p>You are using a free trial and are limited to only a few providers on the network.</p>
                <p>
                  <link_1.default href={urlUtils_1.UrlService.login()} className="font-bold underline">
                    Sign in
                  </link_1.default>{" "}
                  or <d.SignUpButton className="font-bold underline"/> and buy credits to unlock all providers.
                </p>
              </d.AlertDescription>
            </d.Alert>)}

          {isTrialing && !isAnonymousFreeTrialEnabled && (<d.Alert variant="destructive">
              <d.AlertTitle className="text-center text-lg dark:text-white/90">Free Trial!</d.AlertTitle>
              <d.AlertDescription className="space-y-1 text-center dark:text-white/90">
                <p>
                  You are using a free trial and deployments only last <strong>24 hours</strong>.
                </p>
                <p>Add funds to activate your account and remove this limitation.</p>

                <div className="pt-2">
                  <d.AddFundsLink className={(0, utils_1.cn)("hover:no-underline", (0, components_1.buttonVariants)({ variant: "default" }))} href={urlService.payment()}>
                    <span className="whitespace-nowrap">Add Funds</span>
                    <iconoir_react_1.HandCard className="ml-2 text-xs"/>
                  </d.AddFundsLink>
                </div>
              </d.AlertDescription>
            </d.Alert>)}
        </d.ViewPanel>)}

      {zeroBidsForTrialWarningDisplayed && isAnonymousFreeTrialEnabled && (<div className="pt-4">
          <d.Card>
            <d.CardContent>
              <div className="px-16 pb-4 pt-6 text-center">
                <h3 className="mb-4 text-xl font-bold">Waiting for bids</h3>
                <p className="mb-8">
                  It looks like you’re not receiving any bids. This is likely because all trial providers are currently in use. Console offers{" "}
                  {trialProviderCount} providers for trial users, but many more are available for non-trial users. To access the full list of providers, we
                  recommend signing up and adding funds to your account.
                </p>
                <p>
                  <d.Button onClick={function () { return handleCloseDeployment(); }} variant="outline" type="button" size="sm" className="mr-4" disabled={settings.isBlockchainDown}>
                    Close Deployment
                  </d.Button>
                  <d.SignUpButton wrapper="button" color="secondary" variant="default" type="button" size="sm"/>
                </p>
              </div>
            </d.CardContent>
          </d.Card>
        </div>)}
    </>);
};
exports.CreateLease = CreateLease;
