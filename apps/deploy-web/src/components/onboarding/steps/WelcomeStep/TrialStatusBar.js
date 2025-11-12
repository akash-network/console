"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialStatusBar = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var useTrialBalance_1 = require("@src/hooks/useTrialBalance");
var TrialStatusBar = function () {
    var _a = (0, useTrialBalance_1.useTrialBalance)(), TRIAL_TOTAL = _a.total, creditsRemaining = _a.remaining, creditsUsed = _a.used, remainingPercentage = _a.remainingPercentage, isLoading = _a.isLoading, trialEndDate = _a.trialEndDate, daysRemaining = _a.daysRemaining;
    if (isLoading) {
        return (<components_1.Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
            <components_1.Skeleton className="h-8 w-24"/>
            <div className="space-y-1">
              <components_1.Skeleton className="h-7 w-full max-w-64"/>
              <components_1.Skeleton className="h-5 w-full max-w-80"/>
            </div>
          </div>

          <div className="px-1">
            <components_1.Skeleton className="h-3 w-full max-w-xs"/>
          </div>

          <div className="space-y-2">
            <components_1.Skeleton className="h-2 w-full"/>
            <div className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between sm:text-sm">
              <components_1.Skeleton className="h-4 w-20"/>
              <components_1.Skeleton className="h-4 w-40"/>
            </div>
          </div>
        </div>
      </components_1.Card>);
    }
    return (<components_1.Card className="border-border bg-card/50 backdrop-blur-sm">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
          <div className="rounded-md bg-green-500/10 px-3 py-1.5">
            <span className="whitespace-nowrap text-sm font-semibold text-green-500">Trial Active</span>
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold sm:text-lg">Free Trial Credits: ${creditsRemaining.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground sm:text-sm">
              Expires on <react_intl_1.FormattedDate value={trialEndDate} year="numeric" month="long" day="numeric"/> <span className="mx-1.5 hidden sm:inline">•</span>
              <span className="block sm:inline"> {daysRemaining} days remaining</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <iconoir_react_1.InfoCircle className="h-3.5 w-3.5 flex-shrink-0"/>
          <span>Deployments last for maximum 1 day during trial</span>
        </div>

        <div className="space-y-2">
          <components_1.Progress value={remainingPercentage} className="h-2"/>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <span>${creditsUsed.toFixed(2)} used</span>
            <span>
              ${creditsRemaining.toFixed(2)} remaining of ${TRIAL_TOTAL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </components_1.Card>);
};
exports.TrialStatusBar = TrialStatusBar;
