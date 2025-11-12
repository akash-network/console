"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageInput = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var ImageRegistryLogo_1 = require("./ImageRegistryLogo");
var defaultCredentials = {
    host: "docker.io",
    username: "",
    password: ""
};
var ImageInput = function (_a) {
    var serviceIndex = _a.serviceIndex, control = _a.control, credentials = _a.credentials, setValue = _a.setValue;
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".image")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<components_1.FormItem className="w-full">
          <components_1.Input type="text" label={<div className="inline-flex items-center">
                <strong className="text-sm">Docker Image / OS</strong>
                <components_1.CustomTooltip title={<>
                      Docker image of the container.
                      <br />
                      <br />
                      Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                    </>}>
                  <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>
                <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".hasCredentials")} render={function (_a) {
                        var field = _a.field;
                        return (<>
                      <components_1.Checkbox id={"hasCredentials-".concat(serviceIndex)} checked={field.value} onCheckedChange={function (checked) {
                                field.onChange(checked);
                                setValue("services.".concat(serviceIndex, ".credentials"), checked ? defaultCredentials : undefined);
                            }} className="ml-4"/>
                      <label htmlFor={"hasCredentials-".concat(serviceIndex)} className="ml-2 cursor-pointer text-sm">
                        Private
                      </label>
                    </>);
                    }}/>
              </div>} placeholder="Example: mydockerimage:1.01" value={field.value} error={!!fieldState.error} onChange={function (event) { return field.onChange((event.target.value || "").toLowerCase()); }} startIconClassName="pl-2" startIcon={<ImageRegistryLogo_1.ImageRegistryLogo host={credentials === null || credentials === void 0 ? void 0 : credentials.host}/>} endIcon={<link_1.default href={"https://hub.docker.com/search?q=".concat(field.value.split(":")[0], "&type=image")} className={(0, utils_1.cn)((0, components_1.buttonVariants)({
                        variant: "text",
                        size: "icon"
                    }), "text-muted-foreground")} target="_blank">
                <iconoir_react_1.OpenInWindow />
              </link_1.default>} data-testid="image-name-input"/>
          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
exports.ImageInput = ImageInput;
