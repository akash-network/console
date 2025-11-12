"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpOptionsFormControl = void 0;
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var data_1 = require("@src/utils/sdl/data");
var FormPaper_1 = require("./FormPaper");
var HttpOptionsFormControl = function (_a) {
    var _b;
    var _c, _d;
    var control = _a.control, serviceIndex = _a.serviceIndex, exposeIndex = _a.exposeIndex, services = _a.services;
    var currentService = services[serviceIndex];
    return (<FormPaper_1.FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div className={(0, utils_1.cn)("flex items-center", (_b = {}, _b["mb-8"] = !!((_c = currentService.expose[exposeIndex]) === null || _c === void 0 ? void 0 : _c.hasCustomHttpOptions), _b))}>
        <div className="flex items-center">
          <strong className="text-sm">HTTP Options</strong>

          <components_1.CustomTooltip title={<>
                Akash deployment SDL services stanza definitions have been augmented to include “http_options” allowing granular specification of HTTP endpoint
                parameters. Inclusion of the parameters in this section are optional but will afford detailed definitions of attributes such as body/payload max
                size where necessary.
                <br />
                <br />
                <a href="https://akash.network/docs/network-features/deployment-http-options/" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>}>
            <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
          </components_1.CustomTooltip>
        </div>

        <div className="ml-8 flex items-center">
          <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".hasCustomHttpOptions")} render={function (_a) {
            var field = _a.field;
            return (<div className="flex items-center space-x-2">
                <components_1.Checkbox id={"custom-options-".concat(serviceIndex, "-").concat(exposeIndex)} checked={field.value} onCheckedChange={field.onChange}/>
                <label htmlFor={"custom-options-".concat(serviceIndex, "-").concat(exposeIndex)} className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Custom Options
                </label>
              </div>);
        }}/>
        </div>
      </div>

      {((_d = currentService.expose[exposeIndex]) === null || _d === void 0 ? void 0 : _d.hasCustomHttpOptions) && (<>
          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.maxBodySize")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                    Max Body Size
                    <components_1.CustomTooltip title="Sets the maximum size of an individual HTTP request body.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }} min={0}/>);
            }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.readTimeout")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                    Read Timeout
                    <components_1.CustomTooltip title="Duration the proxy will wait for a response from the service.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }} min={0}/>);
            }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.sendTimeout")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                    Send Timeout
                    <components_1.CustomTooltip title="Duration the proxy will wait for the service to accept a request.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }} min={0}/>);
            }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.nextTries")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                    Next Tries
                    <components_1.CustomTooltip title="Number of attempts the proxy will attempt another replica.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }} min={0}/>);
            }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.nextTimeout")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                    Next Timeout
                    <components_1.CustomTooltip title="Duration the proxy will wait for the service to connect to another replica.">
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} className="mb-2 w-full" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }} min={0}/>);
            }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".httpOptions.nextCases")} defaultValue={[]} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormItem className="w-full">
                <components_1.Label className="inline-flex items-center">
                  Next Cases
                  <components_1.CustomTooltip title="Defines the cases where the proxy will try another replica in the service.  Reference the upcoming “Next Cases Attribute Usage” section for details pertaining to allowed values.">
                    <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                  </components_1.CustomTooltip>
                </components_1.Label>
                <components_1.MultipleSelector value={field.value.map(function (v) { return ({ value: v, label: v }); }) || []} options={data_1.nextCases} hidePlaceholderWhenSelected placeholder="Select Next Cases" emptyIndicator={<p className="text-md text-center leading-10 text-gray-600 dark:text-gray-400">no results found.</p>}/>
              </components_1.FormItem>);
            }}/>
        </>)}
    </FormPaper_1.FormPaper>);
};
exports.HttpOptionsFormControl = HttpOptionsFormControl;
