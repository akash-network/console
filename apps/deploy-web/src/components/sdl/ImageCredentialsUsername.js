"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCredentialsUsername = void 0;
var components_1 = require("@akashnetwork/ui/components");
var ImageCredentialsUsername = function (_a) {
    var serviceIndex = _a.serviceIndex, control = _a.control;
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".credentials.username")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<components_1.FormItem className="w-full">
          <components_1.Input type="text" label={<div className="inline-flex items-center">Username</div>} value={field.value} error={!!fieldState.error} onChange={function (event) { return field.onChange(event.target.value || ""); }} data-testid="credentials-username-input"/>

          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
exports.ImageCredentialsUsername = ImageCredentialsUsername;
