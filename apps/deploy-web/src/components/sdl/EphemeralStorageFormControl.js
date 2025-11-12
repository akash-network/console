"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EphemeralStorageFormControl = void 0;
var react_hook_form_1 = require("react-hook-form");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var units_1 = require("@src/utils/akash/units");
var AddStorageButton_1 = require("./AddStorageButton");
var FormPaper_1 = require("./FormPaper");
var EphemeralStorageFormControl = function (_a) {
    var control = _a.control, services = _a.services, serviceIndex = _a.serviceIndex, appendStorage = _a.appendStorage;
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.storage.0.size")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<FormPaper_1.FormPaper>
          <components_1.FormItem>
            <div className="flex flex-col items-start lg:flex-row lg:items-center">
              <div className="flex items-center">
                <md_1.MdStorage className="mr-2 text-2xl text-muted-foreground"/>
                <strong className="text-sm">Ephemeral Storage</strong>

                <components_1.CustomTooltip title={<>
                      The amount of ephemeral disk storage required for this workload.
                      <br />
                      <br />
                      This disk storage is ephemeral, meaning it will be wiped out on every deployment update or provider reboot.
                      <br />
                      <br />
                      The maximum for a single instance is 32 Ti.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is also 32 Ti.
                    </>}>
                  <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>
              </div>

              <div className="mt-2 flex items-center lg:ml-4 lg:mt-0">
                <components_1.Input type="number" color="secondary" value={field.value || ""} error={!!fieldState.error} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }} min={1} step={1} inputClassName="w-[100px]"/>

                <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.storage.0.unit")} defaultValue="" render={function (_a) {
                    var _b;
                    var field = _a.field;
                    return (<components_1.Select value={((_b = field.value) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || ""} onValueChange={field.onChange}>
                      <components_1.SelectTrigger className="ml-1 w-[75px]">
                        <components_1.SelectValue placeholder="Select unit"/>
                      </components_1.SelectTrigger>
                      <components_1.SelectContent>
                        <components_1.SelectGroup>
                          {units_1.storageUnits.map(function (t) {
                            return (<components_1.SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                                {t.suffix}
                              </components_1.SelectItem>);
                        })}
                        </components_1.SelectGroup>
                      </components_1.SelectContent>
                    </components_1.Select>);
                }}/>
              </div>
            </div>

            <components_1.Slider value={[field.value || 0]} min={1} max={5120} step={1} color="secondary" aria-label="Storage" onValueChange={function (newValue) { return field.onChange(newValue[0]); }} className="pt-2"/>

            <components_1.FormMessage />
          </components_1.FormItem>
          {appendStorage && (<AddStorageButton_1.AddStorageButton services={services} serviceIndex={serviceIndex} control={control} storageIndex={0} appendStorage={appendStorage}/>)}
        </FormPaper_1.FormPaper>);
        }}/>);
};
exports.EphemeralStorageFormControl = EphemeralStorageFormControl;
