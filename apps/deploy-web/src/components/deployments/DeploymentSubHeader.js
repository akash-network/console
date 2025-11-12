"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentSubHeader = void 0;
var components_1 = require("@akashnetwork/ui/components");
var formatDistanceToNow_1 = require("date-fns/formatDistanceToNow");
var isValid_1 = require("date-fns/isValid");
var iconoir_react_1 = require("iconoir-react");
var CopyTextToClipboardButton_1 = require("@src/components/shared/CopyTextToClipboardButton");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var PricePerMonth_1 = require("@src/components/shared/PricePerMonth");
var PriceValue_1 = require("@src/components/shared/PriceValue");
var StatusPill_1 = require("@src/components/shared/StatusPill");
var TrialDeploymentBadge_1 = require("@src/components/shared/TrialDeploymentBadge");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useDeploymentMetrics_1 = require("@src/hooks/useDeploymentMetrics");
var useFlag_1 = require("@src/hooks/useFlag");
var useTrialDeploymentTimeRemaining_1 = require("@src/hooks/useTrialDeploymentTimeRemaining");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var DeploymentSubHeader = function (_a) {
    var _b, _c, _d, _e;
    var deployment = _a.deployment, leases = _a.leases;
    var _f = (0, useDeploymentMetrics_1.useDeploymentMetrics)({ deployment: deployment, leases: leases }), deploymentCost = _f.deploymentCost, realTimeLeft = _f.realTimeLeft;
    var avgCost = (0, mathHelpers_1.udenomToDenom)((0, priceUtils_1.getAvgCostPerMonth)(deploymentCost));
    var isActive = deployment.state === "active";
    var hasLeases = !!leases && leases.length > 0;
    var hasActiveLeases = hasLeases && leases.some(function (l) { return l.state === "active"; });
    var denomData = (0, useWalletBalance_1.useDenomData)(((_b = deployment.escrowAccount.state.funds[0]) === null || _b === void 0 ? void 0 : _b.denom) || "");
    var _g = (0, WalletProvider_1.useWallet)(), isCustodial = _g.isCustodial, isTrialing = _g.isTrialing;
    var isAnonymousFreeTrialEnabled = (0, useFlag_1.useFlag)("anonymous_free_trial");
    var appConfig = (0, ServicesProvider_1.useServices)().appConfig;
    var trialDuration = appConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS;
    var trialTimeRemaining = (0, useTrialDeploymentTimeRemaining_1.useTrialDeploymentTimeRemaining)({
        createdHeight: deployment.createdAt,
        trialDurationHours: trialDuration,
        averageBlockTime: 6
    }).timeRemainingText;
    return (<div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <LabelValue_1.LabelValue label="Balance" labelWidth="6rem" value={<div className="flex items-center space-x-2">
              <PriceValue_1.PriceValue denom={((_c = deployment.escrowAccount.state.funds[0]) === null || _c === void 0 ? void 0 : _c.denom) || ""} value={(0, mathHelpers_1.udenomToDenom)(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.escrow : deployment.escrowBalance, 6)}/>
              {isCustodial && (<components_1.CustomTooltip title={<>
                      <strong>
                        {(0, mathHelpers_1.udenomToDenom)(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.escrow : deployment.escrowBalance, 6)}&nbsp;
                        {denomData === null || denomData === void 0 ? void 0 : denomData.label}
                      </strong>
                      <br />
                      The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                    </>}>
                  <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>)}

              {isActive && hasActiveLeases && !!realTimeLeft && realTimeLeft.escrow <= 0 && (<components_1.CustomTooltip title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active.">
                  <iconoir_react_1.WarningCircle className="text-xs text-destructive"/>
                </components_1.CustomTooltip>)}
            </div>}/>
        <LabelValue_1.LabelValue label="Cost" labelWidth="6rem" value={!!deploymentCost && (<div className="flex items-center space-x-2">
                <PricePerMonth_1.PricePerMonth denom={((_d = deployment.escrowAccount.state.funds[0]) === null || _d === void 0 ? void 0 : _d.denom) || ""} perBlockValue={(0, mathHelpers_1.udenomToDenom)(deploymentCost, 10)}/>

                {isCustodial && (<components_1.CustomTooltip title={<span>
                        {avgCost} {denomData === null || denomData === void 0 ? void 0 : denomData.label} / month
                      </span>}>
                    <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
                  </components_1.CustomTooltip>)}
              </div>)}/>
        <LabelValue_1.LabelValue label="Spent" labelWidth="6rem" value={<div className="flex items-center space-x-2">
              <PriceValue_1.PriceValue denom={((_e = deployment.escrowAccount.state.funds[0]) === null || _e === void 0 ? void 0 : _e.denom) || ""} value={(0, mathHelpers_1.udenomToDenom)(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.amountSpent : parseFloat(deployment.transferred.amount), 6)}/>

              {isCustodial && (<components_1.CustomTooltip title={<span>
                      {(0, mathHelpers_1.udenomToDenom)(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.amountSpent : parseFloat(deployment.transferred.amount), 6)}{" "}
                      {denomData === null || denomData === void 0 ? void 0 : denomData.label}
                    </span>}>
                  <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>)}
            </div>}/>
      </div>

      <div>
        <LabelValue_1.LabelValue label="Status" labelWidth="6rem" value={<div className="flex items-center space-x-2">
              <div>{deployment.state}</div>
              <StatusPill_1.StatusPill state={deployment.state} size="small"/>

              {!isAnonymousFreeTrialEnabled && isTrialing && <TrialDeploymentBadge_1.TrialDeploymentBadge createdHeight={deployment.createdAt}/>}
            </div>}/>
        <LabelValue_1.LabelValue label="Time left" labelWidth="6rem" value={<div className="flex items-center space-x-2">
              {realTimeLeft && (0, isValid_1.default)(realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft) && <span>~{(0, formatDistanceToNow_1.default)(realTimeLeft === null || realTimeLeft === void 0 ? void 0 : realTimeLeft.timeLeft)}</span>}
              {!isAnonymousFreeTrialEnabled && isTrialing && trialTimeRemaining && <span className="text-xs text-primary">(Trial: {trialTimeRemaining})</span>}
            </div>}/>
        <LabelValue_1.LabelValue label="DSEQ" labelWidth="6rem" value={<div className="flex items-center space-x-2">
              <span>{deployment.dseq}</span>
              <CopyTextToClipboardButton_1.CopyTextToClipboardButton value={deployment.dseq}/>
            </div>}/>
      </div>
    </div>);
};
exports.DeploymentSubHeader = DeploymentSubHeader;
