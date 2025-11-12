"use strict";
"use client";
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
exports.DeploymentDetailTopBar = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var addHours_1 = require("date-fns/addHours");
var differenceInSeconds_1 = require("date-fns/differenceInSeconds");
var formatDuration_1 = require("date-fns/formatDuration");
var intervalToDuration_1 = require("date-fns/intervalToDuration");
var startOfHour_1 = require("date-fns/startOfHour");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var CustomDropdownLinkItem_1 = require("@src/components/shared/CustomDropdownLinkItem");
var browser_env_config_1 = require("@src/config/browser-env.config");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var PricingProvider_1 = require("@src/context/PricingProvider/PricingProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useDeploymentMetrics_1 = require("@src/hooks/useDeploymentMetrics");
var useManagedDeploymentConfirm_1 = require("@src/hooks/useManagedDeploymentConfirm");
var usePreviousRoute_1 = require("@src/hooks/usePreviousRoute");
var useUser_1 = require("@src/hooks/useUser");
var deploymentSettingsQuery_1 = require("@src/queries/deploymentSettingsQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var priceUtils_1 = require("@src/utils/priceUtils");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var DeploymentDepositModal_1 = require("./DeploymentDepositModal");
var DeploymentDetailTopBar = function (_a) {
    var _b, _c, _d, _e, _f;
    var address = _a.address, loadDeploymentDetail = _a.loadDeploymentDetail, removeLeases = _a.removeLeases, onDeploymentClose = _a.onDeploymentClose, deployment = _a.deployment, leases = _a.leases;
    var _g = (0, LocalNoteProvider_1.useLocalNotes)(), changeDeploymentName = _g.changeDeploymentName, getDeploymentData = _g.getDeploymentData, getDeploymentName = _g.getDeploymentName;
    var udenomToUsd = (0, PricingProvider_1.usePricing)().udenomToUsd;
    var router = (0, navigation_1.useRouter)();
    var _h = (0, WalletProvider_1.useWallet)(), signAndBroadcastTx = _h.signAndBroadcastTx, isManaged = _h.isManaged;
    var _j = (0, react_1.useState)(false), isDepositingDeployment = _j[0], setIsDepositingDeployment = _j[1];
    var storageDeploymentData = getDeploymentData(deployment === null || deployment === void 0 ? void 0 : deployment.dseq);
    var deploymentName = getDeploymentName(deployment === null || deployment === void 0 ? void 0 : deployment.dseq);
    var previousRoute = (0, usePreviousRoute_1.usePreviousRoute)();
    var closeDeploymentConfirm = (0, useManagedDeploymentConfirm_1.useManagedDeploymentConfirm)().closeDeploymentConfirm;
    var user = (0, useUser_1.useUser)().user;
    var deploymentSetting = (0, deploymentSettingsQuery_1.useDeploymentSettingQuery)({ userId: user === null || user === void 0 ? void 0 : user.id, dseq: deployment.dseq });
    var _k = (0, useDeploymentMetrics_1.useDeploymentMetrics)({ deployment: deployment, leases: leases }), realTimeLeft = _k.realTimeLeft, deploymentCost = _k.deploymentCost;
    var confirm = (0, context_1.usePopup)().confirm;
    function handleBackClick() {
        if (previousRoute) {
            router.back();
        }
        else {
            router.push(urlUtils_1.UrlService.deploymentList());
        }
    }
    var onCloseDeployment = function () { return __awaiter(void 0, void 0, void 0, function () {
        var isConfirmed, message, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, closeDeploymentConfirm([deployment.dseq])];
                case 1:
                    isConfirmed = _a.sent();
                    if (!isConfirmed) {
                        return [2 /*return*/];
                    }
                    message = TransactionMessageData_1.TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
                    return [4 /*yield*/, signAndBroadcastTx([message])];
                case 2:
                    response = _a.sent();
                    if (response) {
                        onDeploymentClose();
                        removeLeases();
                        loadDeploymentDetail();
                        analytics_service_1.analyticsService.track("close_deployment", {
                            category: "deployments",
                            label: "Close deployment in deployment detail"
                        });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    function onChangeName() {
        changeDeploymentName(deployment.dseq);
    }
    var redeploy = function () {
        var url = urlUtils_1.UrlService.newDeployment({ redeploy: deployment.dseq });
        router.push(url);
    };
    var onDeploymentDeposit = function (deposit) { return __awaiter(void 0, void 0, void 0, function () {
        var message, response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setIsDepositingDeployment(false);
                    message = TransactionMessageData_1.TransactionMessageData.getDepositDeploymentMsg(address, address, deployment.dseq, deposit, ((_a = deployment.escrowAccount.state.funds[0]) === null || _a === void 0 ? void 0 : _a.denom) || "");
                    return [4 /*yield*/, signAndBroadcastTx([message])];
                case 1:
                    response = _b.sent();
                    if (response) {
                        loadDeploymentDetail();
                        analytics_service_1.analyticsService.track("deployment_deposit", {
                            category: "deployments",
                            label: "Deposit deployment in deployment detail"
                        });
                    }
                    return [2 /*return*/, response];
            }
        });
    }); };
    var setAutoTopUpEnabled = (0, react_1.useCallback)(function (autoTopUpEnabled) { return __awaiter(void 0, void 0, void 0, function () {
        var secTillNextTopUp, secTillClosed, secToDepositFor, deposit, isConfirmed, isSuccess;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(autoTopUpEnabled && (realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft))) return [3 /*break*/, 3];
                    secTillNextTopUp = (0, differenceInSeconds_1.default)((0, addHours_1.default)((0, startOfHour_1.default)(new Date()), 2), new Date());
                    secTillClosed = (0, differenceInSeconds_1.default)(realTimeLeft.timeLeft, new Date());
                    if (!(secTillClosed < secTillNextTopUp)) return [3 /*break*/, 3];
                    secToDepositFor = secTillNextTopUp - secTillClosed;
                    deposit = Math.ceil((deploymentCost * secToDepositFor) / priceUtils_1.averageBlockTime);
                    return [4 /*yield*/, confirm({
                            title: "Deposit required",
                            message: "To enable auto top-up, please deposit $".concat(udenomToUsd(deposit, ((_a = deployment.escrowAccount.state.funds[0]) === null || _a === void 0 ? void 0 : _a.denom) || ""), ". This ensures your deployment remains active until the next scheduled check.")
                        })];
                case 1:
                    isConfirmed = _b.sent();
                    if (!isConfirmed) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, onDeploymentDeposit(deposit)];
                case 2:
                    isSuccess = _b.sent();
                    if (!isSuccess) {
                        return [2 /*return*/];
                    }
                    _b.label = 3;
                case 3:
                    deploymentSetting.setAutoTopUpEnabled(autoTopUpEnabled);
                    return [2 /*return*/];
            }
        });
    }); }, [confirm, (_b = deployment.escrowAccount.state.funds[0]) === null || _b === void 0 ? void 0 : _b.denom, deploymentCost, deploymentSetting, onDeploymentDeposit, realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft, udenomToUsd]);
    return (<>
      <div className="flex items-center space-x-2 px-2 pb-2">
        <components_1.Button aria-label="back" onClick={handleBackClick} size="icon" variant="ghost">
          <iconoir_react_1.NavArrowLeft />
        </components_1.Button>

        <h3 className="truncate text-2xl font-bold">{deploymentName ? deploymentName : "Deployment detail"}</h3>

        <components_1.Button aria-label="refresh" onClick={function () { return loadDeploymentDetail(); }} size="icon" variant="text">
          <iconoir_react_1.Refresh />
        </components_1.Button>

        {(deployment === null || deployment === void 0 ? void 0 : deployment.state) === "active" && (<div className="flex items-center">
            <components_1.DropdownMenu modal={false}>
              <components_1.DropdownMenuTrigger asChild>
                <components_1.Button size="icon" variant="ghost" className="rounded-full" data-testid="deployment-detail-dropdown">
                  <iconoir_react_1.MoreHoriz />
                </components_1.Button>
              </components_1.DropdownMenuTrigger>
              <components_1.DropdownMenuContent align="end">
                <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () {
                onChangeName();
                analytics_service_1.analyticsService.track("edit_name_btn_clk", "Amplitude");
            }} icon={<iconoir_react_1.Edit fontSize="small"/>}>
                  Edit Name
                </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                {(storageDeploymentData === null || storageDeploymentData === void 0 ? void 0 : storageDeploymentData.manifest) && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () {
                    redeploy();
                    analytics_service_1.analyticsService.track("redeploy_btn_clk", "Amplitude");
                }} icon={<iconoir_react_1.Upload fontSize="small"/>}>
                    Redeploy
                  </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () {
                onCloseDeployment();
                analytics_service_1.analyticsService.track("close_deployment_btn_clk", "Amplitude");
            }} icon={<iconoir_react_1.XmarkSquare fontSize="small"/>} data-testid="deployment-detail-close-button">
                  Close
                </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
              </components_1.DropdownMenuContent>
            </components_1.DropdownMenu>
            <components_1.Button variant="default" className="ml-2 whitespace-nowrap" onClick={function () {
                setIsDepositingDeployment(true);
                analytics_service_1.analyticsService.track("deposit_deployment_btn_clk", "Amplitude");
            }} size="sm">
              Add funds
            </components_1.Button>

            {isManaged && (<div className="ml-4 flex items-center gap-2">
                <components_1.Switch checked={(_c = deploymentSetting.data) === null || _c === void 0 ? void 0 : _c.autoTopUpEnabled} onCheckedChange={setAutoTopUpEnabled} disabled={deploymentSetting.isLoading}/>
                <span>Auto top-up</span>
                <components_1.CustomTooltip title={<div className="space-y-2">
                      <div>
                        <div>
                          Estimated amount: ${udenomToUsd(((_d = deploymentSetting.data) === null || _d === void 0 ? void 0 : _d.estimatedTopUpAmount) || 0, browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM)}
                        </div>
                        <div>Check period: {(0, formatDuration_1.default)((0, intervalToDuration_1.default)({ start: 0, end: ((_e = deploymentSetting.data) === null || _e === void 0 ? void 0 : _e.topUpFrequencyMs) || 0 }))}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Auto top-up will only occur if there are insufficient funds to maintain the deployment until the next scheduled check.
                      </div>
                    </div>}>
                  <span className="cursor-help text-muted-foreground">ⓘ</span>
                </components_1.CustomTooltip>
                {deploymentSetting.isLoading && <components_1.Spinner />}
              </div>)}
          </div>)}

        {(deployment === null || deployment === void 0 ? void 0 : deployment.state) === "closed" && (<div className="flex items-center space-x-2">
            <components_1.Button onClick={function () {
                onChangeName();
                analytics_service_1.analyticsService.track("edit_name_btn_clk", "Amplitude");
            }} variant="default" className="whitespace-nowrap" color="secondary" size="sm">
              <iconoir_react_1.Edit fontSize="small"/>
              &nbsp;Edit Name
            </components_1.Button>

            {(storageDeploymentData === null || storageDeploymentData === void 0 ? void 0 : storageDeploymentData.manifest) && (<components_1.Button onClick={function () {
                    redeploy();
                    analytics_service_1.analyticsService.track("redeploy_btn_clk", "Amplitude");
                }} variant="default" className="whitespace-nowrap" color="secondary" size="sm">
                <iconoir_react_1.Upload fontSize="small"/>
                &nbsp;Redeploy
              </components_1.Button>)}
          </div>)}
      </div>

      {isDepositingDeployment && (<DeploymentDepositModal_1.DeploymentDepositModal denom={((_f = deployment.escrowAccount.state.funds[0]) === null || _f === void 0 ? void 0 : _f.denom) || ""} disableMin handleCancel={function () { return setIsDepositingDeployment(false); }} onDeploymentDeposit={onDeploymentDeposit}/>)}
    </>);
};
exports.DeploymentDetailTopBar = DeploymentDetailTopBar;
