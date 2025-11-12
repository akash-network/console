"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CpuFormControl = void 0;
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var units_1 = require("@src/utils/akash/units");
var FormPaper_1 = require("./FormPaper");
var CpuFormControl = function (_a) {
    var control = _a.control, serviceIndex = _a.serviceIndex;
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.cpu")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<FormPaper_1.FormPaper>
          <components_1.FormItem>
            <div className="flex items-center">
              <div className="flex items-center">
                <md_1.MdSpeed className="mr-2 text-2xl text-muted-foreground"/>
                <strong className="text-sm">CPU</strong>

                <components_1.CustomTooltip title={<>
                      The amount of vCPU&apos;s required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is {units_1.validationConfig.maxCpuAmount} vCPU&apos;s.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 512 vCPU&apos;s.
                    </>}>
                  <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>
              </div>
              <components_1.Input type="number" color="secondary" error={!!fieldState.error} value={field.value || ""} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }} min={0.1} step={0.1} max={units_1.validationConfig.maxCpuAmount} inputClassName="ml-4 w-[100px]"/>
            </div>

            <div className="pt-2">
              <components_1.Slider value={[field.value || 0]} min={0.1} max={units_1.validationConfig.maxCpuAmount} step={1} color="secondary" aria-label="CPU" onValueChange={function (newValue) { return field.onChange(newValue[0]); }}/>
            </div>

            <components_1.FormMessage className={(0, utils_1.cn)({ "pt-2": !!fieldState.error })}/>
          </components_1.FormItem>
        </FormPaper_1.FormPaper>);
        }}/>);
};
exports.CpuFormControl = CpuFormControl;
