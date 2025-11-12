"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentCloseAlert = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var NotificationChannelSelect_1 = require("@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect");
var Fieldset_1 = require("@src/components/shared/Fieldset");
var DeploymentCloseAlert = function (_a) {
    var disabled = _a.disabled;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<Fieldset_1.Fieldset label={<div className="flex items-center justify-between">
          <p className="mr-3 text-xl font-bold">Deployment Close</p>
          <components_1.FormField control={control} name="deploymentClosed.enabled" render={function (_a) {
                var field = _a.field;
                return (<components_1.CheckboxWithLabel label="Enabled" disabled={disabled} checked={field.value} onCheckedChange={function (value) { return field.onChange(value); }} labelClassName="font-bold"/>);
            }}/>
        </div>} className="my-2">
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          <NotificationChannelSelect_1.NotificationChannelSelect name="deploymentClosed.notificationChannelId" disabled={disabled}/>
        </div>
      </div>
    </Fieldset_1.Fieldset>);
};
exports.DeploymentCloseAlert = DeploymentCloseAlert;
