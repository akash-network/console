"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCredentialsPassword = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var ImageCredentialsPassword = function (_a) {
    var serviceIndex = _a.serviceIndex, control = _a.control, label = _a.label;
    var _b = (0, react_1.useState)("password"), type = _b[0], setType = _b[1];
    var toggleType = (0, react_1.useCallback)(function () {
        setType(type === "password" ? "text" : "password");
    }, [type]);
    var isClosed = (0, react_1.useMemo)(function () { return type === "password"; }, [type]);
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".credentials.password")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<components_1.FormItem className="w-full">
          <components_1.Input type={type} label={<div className="inline-flex items-center">{label}</div>} value={field.value} error={!!fieldState.error} onChange={function (event) { return field.onChange(event.target.value || ""); }} endIcon={<span className={(0, utils_1.cn)((0, components_1.buttonVariants)({
                        variant: "text",
                        size: "icon"
                    }), "cursor-pointer")} onClick={toggleType}>
                {isClosed ? <iconoir_react_1.EyeClosed /> : <iconoir_react_1.EyeSolid />}
              </span>} data-testid="credentials-password-input"/>

          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
exports.ImageCredentialsPassword = ImageCredentialsPassword;
