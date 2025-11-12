"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentBalanceAlert = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var NotificationChannelSelect_1 = require("@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect");
var Fieldset_1 = require("@src/components/shared/Fieldset");
var DeploymentBalanceAlert = function (_a) {
    var disabled = _a.disabled;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<Fieldset_1.Fieldset label={<div className="flex items-center justify-between">
          <p className="mr-3 text-xl font-bold">Escrow Balance</p>
          <components_1.FormField control={control} name="deploymentBalance.enabled" render={function (_a) {
                var field = _a.field;
                return (<components_1.CheckboxWithLabel label="Enabled" disabled={disabled} checked={field.value} onCheckedChange={function (value) { return field.onChange(value); }} labelClassName="font-bold"/>);
            }}/>
        </div>} subLabel="An additional alert will be sent when the account balance has been increased above threshold value." className="my-2">
      <div className="space-y-4 py-4">
        <div className="space-y-3">
          <NotificationChannelSelect_1.NotificationChannelSelect name="deploymentBalance.notificationChannelId" disabled={disabled}/>
        </div>
        <div className="space-y-3">
          <components_1.FormField control={control} name="deploymentBalance.threshold" render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="number" step={0.000001} label={<div className="inline-flex items-center">
                    Threshold, USD
                    <components_1.CustomTooltip title="Alert if the deployment escrow balance is less than this amount.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }} disabled={disabled}/>);
        }}/>
        </div>
      </div>
    </Fieldset_1.Fieldset>);
};
exports.DeploymentBalanceAlert = DeploymentBalanceAlert;
