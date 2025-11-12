"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCIES = void 0;
exports.TrialDeploymentTooltip = TrialDeploymentTooltip;
var React = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var AddFundsLink_1 = require("@src/components/user/AddFundsLink");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
exports.DEPENDENCIES = {
    AddFundsLink: AddFundsLink_1.AddFundsLink
};
function TrialDeploymentTooltip(_a) {
    var createdHeight = _a.createdHeight, isExpired = _a.isExpired, timeRemainingText = _a.timeRemainingText, trialDuration = _a.trialDuration, _b = _a.dependencies, d = _b === void 0 ? exports.DEPENDENCIES : _b;
    if (!createdHeight) {
        return (<div className="space-y-2 text-left">
        <div className="space-y-1">
          <p className="font-medium">Trial Deployment</p>
          <p className="text-xs text-muted-foreground">Trial deployments are automatically closed after {trialDuration} hours.</p>
        </div>
        <AddFunds dependencies={d}/>
      </div>);
    }
    if (isExpired) {
        return (<div className="space-y-2 text-left">
        <p className="text-sm">This trial deployment has expired and will be closed automatically.</p>
        <AddFunds dependencies={d}/>
      </div>);
    }
    return (<div className="space-y-2 text-left">
      <div className="space-y-1">
        <p className="font-medium">Trial Deployment</p>
        <p className="text-sm text-muted-foreground">
          Time remaining: <span className="font-medium text-primary">{timeRemainingText}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Trial deployments are automatically closed after <span className="font-medium text-primary">{trialDuration}</span> hours.
        </p>
      </div>
      <AddFunds dependencies={d}/>
    </div>);
}
var AddFunds = function (_a) {
    var _b = _a.dependencies, d = _b === void 0 ? exports.DEPENDENCIES : _b;
    var urlService = (0, ServicesProvider_1.useServices)().urlService;
    return (<div className="flex flex-col gap-2">
      <p className="text-xs">Add funds to activate your account.</p>
      <d.AddFundsLink className={(0, utils_1.cn)("w-full hover:no-underline", (0, components_1.buttonVariants)({ variant: "default" }))} href={urlService.payment()}>
        <span className="whitespace-nowrap">Add Funds</span>
        <iconoir_react_1.HandCard className="ml-2 text-xs"/>
      </d.AddFundsLink>
    </div>);
};
