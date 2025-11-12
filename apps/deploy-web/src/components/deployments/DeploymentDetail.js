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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentDetail = void 0;
var react_1 = require("react");
var react_2 = require("react");
var react_3 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var next_seo_1 = require("next-seo");
var DeploymentAlerts_1 = require("@src/components/deployments/DeploymentAlerts/DeploymentAlerts");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useNavigationGuard_1 = require("@src/hooks/useNavigationGuard/useNavigationGuard");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var useUser_1 = require("@src/hooks/useUser");
var useWhen_1 = require("@src/hooks/useWhen");
var useDeploymentQuery_1 = require("@src/queries/useDeploymentQuery");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var route_steps_type_1 = require("@src/types/route-steps.type");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var Title_1 = require("../shared/Title");
var CreateCredentialsButton_1 = require("./CreateCredentialsButton/CreateCredentialsButton");
var DeploymentDetailTopBar_1 = require("./DeploymentDetailTopBar");
var DeploymentLeaseShell_1 = require("./DeploymentLeaseShell");
var DeploymentLogs_1 = require("./DeploymentLogs");
var DeploymentSubHeader_1 = require("./DeploymentSubHeader");
var LeaseRow_1 = require("./LeaseRow");
var ManifestUpdate_1 = require("./ManifestUpdate");
var DeploymentDetail = function (_a) {
    var _b, _c, _d;
    var dseq = _a.dseq;
    var _e = (0, ServicesProvider_1.useServices)(), analyticsService = _e.analyticsService, deploymentLocalStorage = _e.deploymentLocalStorage;
    var router = (0, navigation_1.useRouter)();
    var _f = (0, react_3.useState)("LEASES"), activeTab = _f[0], setActiveTab = _f[1];
    var _g = (0, react_3.useState)(null), editedManifest = _g[0], setEditedManifest = _g[1];
    var _h = (0, WalletProvider_1.useWallet)(), address = _h.address, isWalletLoaded = _h.isWalletLoaded, isManaged = _h.isManaged;
    var isSettingsInit = (0, SettingsProvider_1.useSettings)().isSettingsInit;
    var _j = (0, react_3.useState)([]), leaseRefs = _j[0], setLeaseRefs = _j[1];
    var _k = (0, react_3.useState)(null), deploymentManifest = _k[0], setDeploymentManifest = _k[1];
    var isRemoteDeploy = !!editedManifest && !!(0, remote_deployment_controller_service_1.isCiCdImageInYaml)(editedManifest);
    var repo = isRemoteDeploy ? (0, remote_deployment_controller_service_1.extractRepositoryUrl)(editedManifest) : null;
    var user = (0, useUser_1.useUser)().user;
    var isAlertsEnabled = (0, useFlag_1.useFlag)("alerts") && !!(user === null || user === void 0 ? void 0 : user.userId) && isManaged;
    var _l = (0, react_3.useState)({}), badgedTabs = _l[0], setBadgedTabs = _l[1];
    var _m = (0, useDeploymentQuery_1.useDeploymentDetail)(address, dseq), deployment = _m.data, isLoadingDeployment = _m.isFetching, getDeploymentDetail = _m.refetch, deploymentError = _m.error;
    var _o = (0, useLeaseQuery_1.useDeploymentLeaseList)(address, deployment, {
        enabled: (deployment === null || deployment === void 0 ? void 0 : deployment.state) === "active",
        refetchOnWindowFocus: false
    }), leases = _o.data, isLoadingLeases = _o.isLoading, getLeases = _o.refetch, removeLeases = _o.remove, isLeasesLoaded = _o.isSuccess;
    (0, react_3.useEffect)(function () {
        if (leases) {
            // Redirect to select bids if has no lease
            if ((deployment === null || deployment === void 0 ? void 0 : deployment.state) === "active" && leases.length === 0) {
                router.replace(urlUtils_1.UrlService.newDeployment({ dseq: dseq, step: route_steps_type_1.RouteStep.createLeases }));
            }
            // Set the array of refs for lease rows
            // To be able to refresh lease status when refreshing deployment detail
            if (leases.length > 0 && leases.length !== leaseRefs.length) {
                setLeaseRefs(function (elRefs) {
                    return Array(leases.length)
                        .fill(null)
                        .map(function (_, i) { return elRefs[i] || (0, react_3.createRef)(); });
                });
            }
        }
    }, [deployment === null || deployment === void 0 ? void 0 : deployment.state, dseq, leaseRefs.length, leases, router]);
    var isDeploymentNotFound = deploymentError && ((_d = (_c = (_b = deploymentError.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.includes("Deployment not found")) && !isLoadingDeployment;
    var hasLeases = leases && leases.length > 0;
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var _p = (0, useProvidersQuery_1.useProviderList)(), providers = _p.data, isLoadingProviders = _p.isFetching, getProviders = _p.refetch;
    (0, react_3.useEffect)(function () {
        if (deployment) {
            getLeases();
            getProviders();
            var deploymentData = deploymentLocalStorage.get(address, dseq);
            setDeploymentManifest((deploymentData === null || deploymentData === void 0 ? void 0 : deploymentData.manifest) || "");
        }
    }, [deployment, dseq, getLeases, getProviders, address, deploymentLocalStorage]);
    var isActive = (deployment === null || deployment === void 0 ? void 0 : deployment.state) === "active" && (leases === null || leases === void 0 ? void 0 : leases.some(function (x) { return x.state === "active"; }));
    var tabs = (0, react_2.useMemo)(function () {
        var tabs = [
            {
                value: "LEASES",
                label: "Leases"
            }
        ];
        if (isAlertsEnabled) {
            tabs.push({
                label: "Alerts",
                value: "ALERTS",
                badged: badgedTabs.ALERTS
            });
        }
        if (isActive) {
            tabs.push({
                label: "Logs",
                value: "LOGS"
            }, {
                label: "Shell",
                value: "SHELL"
            }, {
                label: "Events",
                value: "EVENTS"
            });
        }
        tabs.push({
            label: "Update",
            value: "EDIT"
        });
        return tabs;
    }, [badgedTabs.ALERTS, isActive, isAlertsEnabled]);
    var searchParams = (0, navigation_1.useSearchParams)();
    var tabQuery = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("tab");
    var logsModeQuery = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("logsMode");
    (0, react_3.useEffect)(function () {
        if (isWalletLoaded && isSettingsInit) {
            getDeploymentDetail();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWalletLoaded, isSettingsInit]);
    (0, react_3.useEffect)(function () {
        if (!tabQuery) {
            return;
        }
        var tab = tabs.find(function (tab) { return tab.value === tabQuery; });
        if (tab) {
            setActiveTab(tab.value);
        }
        else if (isLeasesLoaded) {
            router.replace(urlUtils_1.UrlService.deploymentDetails(dseq));
        }
    }, [tabQuery, logsModeQuery, leases, tabs, isLeasesLoaded, router, dseq]);
    function loadDeploymentDetail() {
        return __awaiter(this, void 0, void 0, function () {
            var deploymentResult;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!isLoadingDeployment) return [3 /*break*/, 3];
                        return [4 /*yield*/, getDeploymentDetail()];
                    case 1:
                        deploymentResult = _b.sent();
                        return [4 /*yield*/, getLeases()];
                    case 2:
                        _b.sent();
                        if (((_a = deploymentResult.data) === null || _a === void 0 ? void 0 : _a.state) === "active") {
                            leaseRefs.forEach(function (lr) { var _a; return (_a = lr.current) === null || _a === void 0 ? void 0 : _a.getLeaseStatus(); });
                        }
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    var changeTab = function (tab) {
        setActiveTab(tab);
        router.replace(urlUtils_1.UrlService.deploymentDetails(dseq, tab));
        analyticsService.track("navigate_tab", {
            category: "deployments",
            label: "Navigate tab ".concat(tab, " in deployment detail"),
            tab: tab
        });
    };
    var recordAlertsChange = (0, react_1.useCallback)(function (_a) {
        var hasChanges = _a.hasChanges;
        return setBadgedTabs(function (prevState) { return (__assign(__assign({}, prevState), { ALERTS: hasChanges })); });
    }, [setBadgedTabs]);
    (0, useNavigationGuard_1.useNavigationGuard)({
        enabled: isAlertsEnabled && !!badgedTabs.ALERTS,
        message: "You have unsaved alert configuration changes that will be lost. Would you like to continue?",
        skipWhen: function (params) { return params.to.startsWith("/deployments/".concat(dseq)); }
    });
    (0, useWhen_1.useWhen)((deployment === null || deployment === void 0 ? void 0 : deployment.state) !== "active", function () {
        setBadgedTabs({});
    });
    return (<Layout_1.default isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet containerClassName="pb-0">
      <next_seo_1.NextSeo title={"Deployment detail #".concat(dseq)}/>

      {deployment && (<DeploymentDetailTopBar_1.DeploymentDetailTopBar address={address} loadDeploymentDetail={loadDeploymentDetail} removeLeases={removeLeases} onDeploymentClose={function () { return setActiveTab("LEASES"); }} deployment={deployment} leases={leases}/>)}

      {isDeploymentNotFound && (<div className="mt-8 text-center">
          <Title_1.Title className="mb-2">404</Title_1.Title>
          <p>This deployment does not exist or it was created using another wallet.</p>
          <div className="pt-4">
            <link_1.default href={urlUtils_1.UrlService.home()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "inline-flex items-center space-x-2")}>
              <iconoir_react_1.ArrowLeft className="text-sm"/>
              <span>Go to homepage</span>
            </link_1.default>
          </div>
        </div>)}

      {deployment && isLeasesLoaded && (<>
          <DeploymentSubHeader_1.DeploymentSubHeader deployment={deployment} leases={leases}/>

          <components_1.Tabs value={activeTab} onValueChange={function (value) { return changeTab(value); }}>
            <components_1.TabsList className={(0, utils_1.cn)("grid w-full", {
                "grid-cols-2": tabs.length === 2,
                "grid-cols-3": tabs.length === 3,
                "grid-cols-4": tabs.length === 4,
                "grid-cols-5": tabs.length === 5,
                "grid-cols-6": tabs.length === 6
            })}>
              {tabs.map(function (tab) { return (<components_1.TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.badged && <span className="ml-4 inline-block h-2 w-2 rounded-full bg-red-500"/>}
                </components_1.TabsTrigger>); })}
            </components_1.TabsList>
            {activeTab === "EDIT" && deployment && leases && (<ManifestUpdate_1.ManifestUpdate editedManifest={editedManifest} onManifestChange={setEditedManifest} isRemoteDeploy={isRemoteDeploy} deployment={deployment} leases={leases} closeManifestEditor={function () {
                    setActiveTab("EVENTS");
                    loadDeploymentDetail();
                }}/>)}
            {activeTab === "LOGS" && <DeploymentLogs_1.DeploymentLogs leases={leases} selectedLogsMode="logs"/>}
            {activeTab === "EVENTS" && <DeploymentLogs_1.DeploymentLogs leases={leases} selectedLogsMode="events"/>}
            {activeTab === "SHELL" && <DeploymentLeaseShell_1.DeploymentLeaseShell leases={leases}/>}
            {isAlertsEnabled && (<div className={(0, utils_1.cn)({ hidden: activeTab !== "ALERTS" })}>
                <DeploymentAlerts_1.DeploymentAlerts deployment={deployment} onStateChange={recordAlertsChange}/>
              </div>)}
            {activeTab === "LEASES" && (<div className="py-4">
                {leases && !providerCredentials.details.usable && <CreateCredentialsButton_1.CreateCredentialsButton containerClassName="mb-4" afterCreate={loadDeploymentDetail}/>}

                {leases &&
                    leases.map(function (lease, i) { return (<LeaseRow_1.LeaseRow repo={repo} key={lease.id} index={i} lease={lease} ref={leaseRefs[i]} deploymentManifest={deploymentManifest || ""} dseq={dseq} providers={providers || []} loadDeploymentDetail={loadDeploymentDetail} isRemoteDeploy={isRemoteDeploy}/>); })}

                {!hasLeases && !isLoadingLeases && !isLoadingDeployment && <>This deployment doesn't have any leases</>}

                {(isLoadingLeases || isLoadingDeployment) && !hasLeases && (<div className="flex items-center justify-center p-8">
                    <components_1.Spinner size="large"/>
                  </div>)}
              </div>)}
          </components_1.Tabs>
        </>)}
    </Layout_1.default>);
};
exports.DeploymentDetail = DeploymentDetail;
