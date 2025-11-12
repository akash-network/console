"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCIES = void 0;
exports.TrialDeploymentBadge = TrialDeploymentBadge;
var React = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var lucide_react_1 = require("lucide-react");
var browser_env_config_1 = require("@src/config/browser-env.config");
var useTrialDeploymentTimeRemaining_1 = require("@src/hooks/useTrialDeploymentTimeRemaining");
var TrialDeploymentTooltip_1 = require("./TrialDeploymentTooltip");
exports.DEPENDENCIES = {
    Badge: components_1.Badge,
    CustomTooltip: components_1.CustomTooltip,
    TrialDeploymentTooltip: TrialDeploymentTooltip_1.TrialDeploymentTooltip,
    useTrialTimeRemaining: useTrialDeploymentTimeRemaining_1.useTrialDeploymentTimeRemaining
};
function TrialDeploymentBadge(_a) {
    var createdHeight = _a.createdHeight, trialDurationHours = _a.trialDurationHours, _b = _a.averageBlockTime, averageBlockTime = _b === void 0 ? 6 : _b, className = _a.className, _c = _a.dependencies, d = _c === void 0 ? exports.DEPENDENCIES : _c;
    var trialDuration = trialDurationHours !== null && trialDurationHours !== void 0 ? trialDurationHours : browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS;
    var _d = d.useTrialTimeRemaining({
        createdHeight: createdHeight,
        trialDurationHours: trialDuration,
        averageBlockTime: averageBlockTime
    }), isExpired = _d.isExpired, timeRemainingText = _d.timeRemainingText;
    return (<d.CustomTooltip title={<d.TrialDeploymentTooltip createdHeight={createdHeight} isExpired={isExpired} timeRemainingText={timeRemainingText} trialDuration={trialDuration}/>}>
      <div className="inline-flex items-center gap-1">
        <d.Badge variant={isExpired ? "destructive" : "default"} className={(0, utils_1.cn)("inline-flex cursor-help items-center gap-1", className)}>
          <span>Trial</span>
          <lucide_react_1.Info className="h-3 w-3"/>
        </d.Badge>
      </div>
    </d.CustomTooltip>);
}
