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
exports.DeploymentListRow = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var differenceInCalendarDays_1 = require("date-fns/differenceInCalendarDays");
var formatDistanceToNow_1 = require("date-fns/formatDistanceToNow");
var isValid_1 = require("date-fns/isValid");
var iconoir_react_1 = require("iconoir-react");
var lodash_1 = require("lodash");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useManagedDeploymentConfirm_1 = require("@src/hooks/useManagedDeploymentConfirm");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var useRealTimeLeft_1 = require("@src/hooks/useRealTimeLeft");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var LocalNoteProvider_1 = require("../../context/LocalNoteProvider");
var shared_1 = require("../shared");
var CopyTextToClipboardButton_1 = require("../shared/CopyTextToClipboardButton");
var CustomDropdownLinkItem_1 = require("../shared/CustomDropdownLinkItem");
var PricePerMonth_1 = require("../shared/PricePerMonth");
var PriceValue_1 = require("../shared/PriceValue");
var SpecDetailList_1 = require("../shared/SpecDetailList");
var DeploymentName_1 = require("./DeploymentName/DeploymentName");
var DeploymentDepositModal_1 = require("./DeploymentDepositModal");
var LeaseChip_1 = require("./LeaseChip");
var DeploymentListRow = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var deployment = _a.deployment, isSelectable = _a.isSelectable, onSelectDeployment = _a.onSelectDeployment, checked = _a.checked, providers = _a.providers, refreshDeployments = _a.refreshDeployments;
    var router = (0, navigation_1.useRouter)();
    var _h = (0, react_1.useState)(false), open = _h[0], setOpen = _h[1];
    var _j = (0, react_1.useState)(false), isDepositingDeployment = _j[0], setIsDepositingDeployment = _j[1];
    var _k = (0, LocalNoteProvider_1.useLocalNotes)(), changeDeploymentName = _k.changeDeploymentName, getDeploymentData = _k.getDeploymentData;
    var _l = (0, WalletProvider_1.useWallet)(), address = _l.address, signAndBroadcastTx = _l.signAndBroadcastTx, isManagedWallet = _l.isManaged, isTrialing = _l.isTrialing;
    var isActive = deployment.state === "active";
    var _m = (0, useLeaseQuery_1.useAllLeases)(address, { enabled: !!deployment && isActive }), leases = _m.data, isLoadingLeases = _m.isLoading;
    var filteredLeases = leases === null || leases === void 0 ? void 0 : leases.filter(function (l) { return l.dseq === deployment.dseq; });
    var hasLeases = leases && !!leases.length && leases.some(function (l) { return l.dseq === deployment.dseq && l.state === "active"; });
    var hasActiveLeases = hasLeases && (filteredLeases === null || filteredLeases === void 0 ? void 0 : filteredLeases.some(function (l) { return l.state === "active"; }));
    var isAllLeasesClosed = hasLeases && !(filteredLeases === null || filteredLeases === void 0 ? void 0 : filteredLeases.some(function (l) { return l.state === "active"; }));
    var deploymentCost = hasLeases ? filteredLeases === null || filteredLeases === void 0 ? void 0 : filteredLeases.reduce(function (prev, current) { return prev + parseFloat(current.price.amount); }, 0) : 0;
    var timeLeft = (0, priceUtils_1.getTimeLeft)(deploymentCost || 0, deployment.escrowBalance);
    var realTimeLeft = (0, useRealTimeLeft_1.useRealTimeLeft)(deploymentCost || 0, deployment.escrowBalance, parseFloat(deployment.escrowAccount.state.settled_at), deployment.createdAt);
    var showTimeLeftWarning = (0, differenceInCalendarDays_1.default)(timeLeft, new Date()) < 7;
    var escrowBalance = isActive && hasActiveLeases ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.escrow : deployment.escrowBalance;
    var isRunningOutOfFunds = escrowBalance && escrowBalance <= 0;
    var amountSpent = isActive && hasActiveLeases ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.amountSpent : parseFloat(deployment.transferred.amount);
    var isValidTimeLeft = isActive && hasActiveLeases && (0, isValid_1.default)(realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft);
    var avgCost = (0, mathHelpers_1.udenomToDenom)((0, priceUtils_1.getAvgCostPerMonth)(deploymentCost || 0));
    var storageDeploymentData = getDeploymentData(deployment === null || deployment === void 0 ? void 0 : deployment.dseq);
    var denomData = (0, useWalletBalance_1.useDenomData)(((_b = deployment.escrowAccount.state.funds[0]) === null || _b === void 0 ? void 0 : _b.denom) || "");
    var closeDeploymentConfirm = (0, useManagedDeploymentConfirm_1.useManagedDeploymentConfirm)().closeDeploymentConfirm;
    var providersByOwner = (0, react_1.useMemo)(function () { return (0, lodash_1.keyBy)(providers, function (p) { return p.owner; }); }, [providers]);
    var lease = filteredLeases === null || filteredLeases === void 0 ? void 0 : filteredLeases.find(function (lease) { return !!((lease === null || lease === void 0 ? void 0 : lease.provider) && providersByOwner[lease.provider]); });
    var provider = providersByOwner[(lease === null || lease === void 0 ? void 0 : lease.provider) || ""];
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var leaseStatus = (0, useLeaseQuery_1.useLeaseStatus)({ provider: provider, lease: lease, enabled: !!(provider && lease && providerCredentials.details.usable) }).data;
    var isAnonymousFreeTrialEnabled = (0, useFlag_1.useFlag)("anonymous_free_trial");
    var viewDeployment = (0, react_1.useCallback)(function () {
        router.push(urlUtils_1.UrlService.deploymentDetails(deployment.dseq));
    }, [router, deployment.dseq]);
    function handleMenuClick() {
        setOpen(true);
    }
    var handleMenuClose = function () {
        setOpen(false);
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
                        refreshDeployments();
                        analytics_service_1.analyticsService.track("deployment_deposit", {
                            category: "deployments",
                            label: "Deposit to deployment from list"
                        });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onCloseDeployment = function () { return __awaiter(void 0, void 0, void 0, function () {
        var isConfirmed, message, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleMenuClose();
                    return [4 /*yield*/, closeDeploymentConfirm([deployment.dseq])];
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
                        if (onSelectDeployment) {
                            onSelectDeployment({ id: deployment.dseq, isShiftPressed: false });
                        }
                        refreshDeployments();
                        analytics_service_1.analyticsService.track("close_deployment", {
                            category: "deployments",
                            label: "Close deployment from list"
                        });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var redeploy = function () {
        var url = urlUtils_1.UrlService.newDeployment({ redeploy: deployment.dseq });
        router.push(url);
    };
    function showDepositModal(e) {
        e === null || e === void 0 ? void 0 : e.preventDefault();
        e === null || e === void 0 ? void 0 : e.stopPropagation();
        setIsDepositingDeployment(true);
    }
    var escrowBalanceInDenom = (0, react_1.useMemo)(function () {
        var uDenomBalance;
        if (isActive && hasActiveLeases && realTimeLeft) {
            uDenomBalance = realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.escrow;
        }
        else {
            uDenomBalance = escrowBalance;
        }
        return uDenomBalance && (0, mathHelpers_1.udenomToDenom)(uDenomBalance, 6);
    }, [isActive, hasActiveLeases, realTimeLeft, escrowBalance]);
    return (<>
      <components_1.TableRow className="hover:bg-muted-foreground/10 [&>td]:p-2">
        <components_1.TableCell>
          <div className="flex items-center justify-center">
            <SpecDetailList_1.SpecDetailList cpuAmount={deployment.cpuAmount} gpuAmount={deployment.gpuAmount} memoryAmount={deployment.memoryAmount} storageAmount={deployment.storageAmount} isActive={isActive}/>
          </div>
        </components_1.TableCell>
        <components_1.TableCell className="max-w-[100px] text-center">
          <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }))} href={urlUtils_1.UrlService.deploymentDetails(deployment.dseq)}>
            <DeploymentName_1.DeploymentName deployment={deployment} deploymentServices={leaseStatus === null || leaseStatus === void 0 ? void 0 : leaseStatus.services} providerHostUri={provider === null || provider === void 0 ? void 0 : provider.hostUri}/>
          </link_1.default>

          {!isAnonymousFreeTrialEnabled && isTrialing && (<div className="mt-2">
              <shared_1.TrialDeploymentBadge createdHeight={deployment.createdAt}/>
            </div>)}
        </components_1.TableCell>
        <components_1.TableCell className="text-center">
          <div className="flex items-center justify-center gap-x-1">
            <span>{deployment.dseq || "N/A"}</span>
            <CopyTextToClipboardButton_1.CopyTextToClipboardButton value={deployment.dseq}/>
          </div>
        </components_1.TableCell>
        <components_1.TableCell className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {isActive && !!deploymentCost && (<components_1.CustomTooltip disabled={isManagedWallet} title={<span>
                    {avgCost} {denomData === null || denomData === void 0 ? void 0 : denomData.label} / month
                  </span>}>
                <div className={"flex items-center ".concat(isManagedWallet ? "" : "cursor-help")}>
                  <iconoir_react_1.CalendarArrowDown className="mr-2 text-xs"/>
                  <PricePerMonth_1.PricePerMonth denom={((_c = deployment.escrowAccount.state.funds[0]) === null || _c === void 0 ? void 0 : _c.denom) || ""} perBlockValue={(0, mathHelpers_1.udenomToDenom)(deploymentCost, 10)} className="whitespace-nowrap"/>
                </div>
              </components_1.CustomTooltip>)}
            {isActive && !!escrowBalanceInDenom && !!escrowBalance && (<components_1.CustomTooltip title={<div className="text-left">
                    <div className="space-x-2">
                      <span>Balance:</span>
                      <strong>
                        {isManagedWallet ? (<PriceValue_1.PriceValue denom={((_d = deployment.escrowAccount.state.funds[0]) === null || _d === void 0 ? void 0 : _d.denom) || ""} value={escrowBalanceInDenom}/>) : ("".concat(escrowBalanceInDenom, " ").concat(denomData === null || denomData === void 0 ? void 0 : denomData.label))}
                      </strong>
                    </div>
                    <div className="space-x-2">
                      <span>Spent:</span>
                      <strong>
                        {isManagedWallet ? (<PriceValue_1.PriceValue denom={((_e = deployment.escrowAccount.state.funds[0]) === null || _e === void 0 ? void 0 : _e.denom) || ""} value={(0, mathHelpers_1.udenomToDenom)(amountSpent || 0, 2)}/>) : ("".concat((0, mathHelpers_1.udenomToDenom)(amountSpent || 0, 2), " ").concat(denomData === null || denomData === void 0 ? void 0 : denomData.label))}
                      </strong>
                    </div>
                    <br />
                    <p className="text-xs text-muted-foreground">
                      The escrow account balance will be fully returned to your wallet balance when the deployment is closed.
                    </p>
                  </div>}>
                <div className="inline-flex cursor-help">
                  <iconoir_react_1.Coins className="mr-2 text-xs"/>
                  <PriceValue_1.PriceValue denom={((_f = deployment.escrowAccount.state.funds[0]) === null || _f === void 0 ? void 0 : _f.denom) || ""} value={escrowBalanceInDenom}/>
                </div>
              </components_1.CustomTooltip>)}
          </div>
          {isActive && ((isValidTimeLeft && realTimeLeft) || isRunningOutOfFunds) && (<components_1.CustomTooltip disabled={!(showTimeLeftWarning || isRunningOutOfFunds)} title={<>
                  Your deployment will close soon,{" "}
                  <a href="#" onClick={showDepositModal}>
                    Add Funds
                  </a>{" "}
                  to keep it running.
                </>}>
              <div className={"inline-flex items-center space-x-2 text-xs ".concat(showTimeLeftWarning || isRunningOutOfFunds ? "cursor-help text-warning" : "")}>
                <span>
                  {isRunningOutOfFunds
                ? "Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active."
                : getTimeLeftText(realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft)}
                </span>
                {showTimeLeftWarning && <iconoir_react_1.WarningTriangle className="text-xs"/>}
              </div>
            </components_1.CustomTooltip>)}
        </components_1.TableCell>

        <components_1.TableCell className="text-center">
          {hasLeases && (<div className="inline-flex flex-wrap items-center">
              {filteredLeases === null || filteredLeases === void 0 ? void 0 : filteredLeases.map(function (lease) { return <LeaseChip_1.LeaseChip key={lease.id} lease={lease} providers={providers}/>; })}
            </div>)}
          {isLoadingLeases && <components_1.Spinner size="small"/>}
          {!isLoadingLeases && isAllLeasesClosed && <components_1.Badge>All leases closed</components_1.Badge>}
        </components_1.TableCell>

        <components_1.TableCell>
          <div className="flex items-center justify-end">
            {isSelectable && (<components_1.Checkbox checked={checked} expandedTouchTarget={true} onClick={function (event) {
                event.stopPropagation();
                onSelectDeployment === null || onSelectDeployment === void 0 ? void 0 : onSelectDeployment({ id: deployment.dseq, isShiftPressed: event.shiftKey });
            }}/>)}

            <div className="">
              <components_1.DropdownMenu modal={false} open={open}>
                <components_1.DropdownMenuTrigger asChild>
                  <components_1.Button onClick={handleMenuClick} size="icon" variant="ghost" className="rounded-full">
                    <iconoir_react_1.MoreHoriz />
                  </components_1.Button>
                </components_1.DropdownMenuTrigger>
                <components_1.DropdownMenuContent align="end" onMouseLeave={function () { return setOpen(false); }} onClick={function (e) {
            e.stopPropagation();
        }}>
                  <ClickAwayListener_1.default onClickAway={function () { return setOpen(false); }}>
                    <div>
                      {isActive && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={showDepositModal} icon={<iconoir_react_1.Plus fontSize="small"/>}>
                          Add funds
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                      <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return changeDeploymentName(deployment.dseq); }} icon={<iconoir_react_1.Edit fontSize="small"/>}>
                        Edit name
                      </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                      {(storageDeploymentData === null || storageDeploymentData === void 0 ? void 0 : storageDeploymentData.manifest) && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return redeploy(); }} icon={<iconoir_react_1.Upload fontSize="small"/>}>
                          Redeploy
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                      {isActive && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return onCloseDeployment(); }} icon={<iconoir_react_1.XmarkSquare fontSize="small"/>}>
                          Close
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                    </div>
                  </ClickAwayListener_1.default>
                </components_1.DropdownMenuContent>
              </components_1.DropdownMenu>
            </div>

            <div className="flex pr-2">
              <components_1.Button onClick={viewDeployment} size="icon" variant="ghost" className="rounded-full">
                <iconoir_react_1.NavArrowRight />
              </components_1.Button>
            </div>
          </div>
        </components_1.TableCell>
      </components_1.TableRow>

      {isActive && isDepositingDeployment && (<DeploymentDepositModal_1.DeploymentDepositModal denom={((_g = deployment.escrowAccount.state.funds[0]) === null || _g === void 0 ? void 0 : _g.denom) || ""} disableMin handleCancel={function () { return setIsDepositingDeployment(false); }} onDeploymentDeposit={onDeploymentDeposit}/>)}
    </>);
};
exports.DeploymentListRow = DeploymentListRow;
function getTimeLeftText(timeLeft) {
    if (!timeLeft)
        return "";
    var text = (0, formatDistanceToNow_1.default)(timeLeft);
    return "will be active for ".concat(text.startsWith("about") ? text : "about ".concat(text));
}
