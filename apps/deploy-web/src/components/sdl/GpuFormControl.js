"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpuFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var FormControl_1 = require("@mui/material/FormControl");
var IconButton_1 = require("@mui/material/IconButton");
var InputLabel_1 = require("@mui/material/InputLabel");
var MenuItem_1 = require("@mui/material/MenuItem");
var Select_1 = require("@mui/material/Select");
var iconoir_react_1 = require("iconoir-react");
var flow_1 = require("lodash/flow");
var flatMap_1 = require("lodash/fp/flatMap");
var keyBy_1 = require("lodash/fp/keyBy");
var gpu_1 = require("@src/utils/akash/gpu");
var units_1 = require("@src/utils/akash/units");
var FormPaper_1 = require("./FormPaper");
var GpuFormControl = function (_a) {
    var gpuModels = _a.gpuModels, control = _a.control, serviceIndex = _a.serviceIndex, hasGpu = _a.hasGpu, currentService = _a.currentService, setValue = _a.setValue, hideHasGpu = _a.hideHasGpu;
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".profile.gpuModels"),
        keyName: "id"
    }), formGpuModels = _b.fields, removeFormGpuModel = _b.remove, appendFormGpuModel = _b.append;
    var onAddGpuModel = function () {
        appendFormGpuModel({ vendor: "nvidia", name: "", memory: "", interface: "" });
    };
    var gpuVendors = (0, react_1.useMemo)(function () {
        return gpuModels
            ? gpuModels.map(function (vendor, index) {
                return { id: index, value: vendor.name };
            })
            : gpu_1.gpuVendors;
    }, [gpuModels]);
    var gpuModelsByName = (0, react_1.useMemo)(function () {
        return (0, flow_1.default)([(0, flatMap_1.default)("models"), (0, keyBy_1.default)("name")])(gpuModels || []);
    }, [gpuModels]);
    var theOnlyForModelOrEmpty = (0, react_1.useCallback)(function (name, attribute) {
        return gpuModelsByName[name][attribute].length === 1 ? gpuModelsByName[name][attribute][0] : "";
    }, [gpuModelsByName]);
    return (<FormPaper_1.FormPaper>
      <div className="flex items-center">
        <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.gpu")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<components_1.FormItem className={(0, utils_1.cn)("w-full")}>
              <div className="flex items-center">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <md_1.MdSpeed className="mr-2 text-2xl text-muted-foreground"/>
                    <strong>GPU</strong>

                    <components_1.CustomTooltip title={<>
                          The amount of GPUs required for this workload.
                          <br />
                          <br />
                          You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any GPU model will
                          bid on your workload.
                          <br />
                          <br />
                          <a href="https://akash.network/docs/getting-started/stack-definition-language/#gpu-support" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>}>
                      <iconoir_react_1.InfoCircle className="ml-4 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>

                  {!hideHasGpu && (<react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.hasGpu")} render={function (_a) {
                        var field = _a.field;
                        return (<components_1.Checkbox checked={field.value} onCheckedChange={function (checked) {
                                field.onChange(checked);
                                if (checked && formGpuModels.length === 0) {
                                    onAddGpuModel();
                                }
                                if (checked && currentService.profile.gpu === 0) {
                                    setValue("services.".concat(serviceIndex, ".profile.gpu"), 1);
                                }
                            }} className="ml-2"/>);
                    }}/>)}
                </div>

                {hasGpu && (<div className="ml-4">
                    <components_1.Input type="number" color="secondary" value={field.value || ""} error={!!fieldState.error} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }} min={1} step={1} max={units_1.validationConfig.maxGpuAmount} inputClassName="w-[100px]"/>
                  </div>)}
              </div>

              {hasGpu && (<components_1.Slider value={[field.value || 0]} min={1} max={units_1.validationConfig.maxGpuAmount} step={1} color="secondary" aria-label="GPUs" className="pt-2" onValueChange={function (newValue) { return field.onChange(newValue); }}/>)}

              <components_1.FormMessage className={(0, utils_1.cn)({ "pt-2": !!fieldState.error })}/>
            </components_1.FormItem>);
        }}/>
      </div>

      {hasGpu && (<>
          <div className="my-4">
            <p className="text-xs text-muted-foreground">
              Picking specific GPU models below, filters out providers that don't have those GPUs and may reduce the number of bids you receive.
            </p>
          </div>

          {formGpuModels.map(function (formGpu, formGpuIndex) {
                var _a, _b, _c;
                var currentGpu = currentService.profile.gpuModels && currentService.profile.gpuModels[formGpuIndex];
                var models = ((_a = gpuModels === null || gpuModels === void 0 ? void 0 : gpuModels.find(function (u) { return u.name === (currentGpu === null || currentGpu === void 0 ? void 0 : currentGpu.vendor); })) === null || _a === void 0 ? void 0 : _a.models) || [];
                var interfaces = ((_b = models.find(function (m) { return m.name === (currentGpu === null || currentGpu === void 0 ? void 0 : currentGpu.name); })) === null || _b === void 0 ? void 0 : _b.interface) || [];
                var memorySizes = ((_c = models.find(function (m) { return m.name === (currentGpu === null || currentGpu === void 0 ? void 0 : currentGpu.name); })) === null || _c === void 0 ? void 0 : _c.memory) || [];
                return (<div className="mb-2" key={"".concat(formGpuIndex).concat(formGpu.vendor).concat(formGpu.name).concat(formGpu.memory).concat(formGpu.interface)}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <div className="col-span-2">
                    <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".vendor")} defaultValue="" render={function (_a) {
                        var field = _a.field;
                        return (<FormControl_1.default fullWidth>
                          <InputLabel_1.default id="gpu-vendor-select-label" size="small">
                            Vendor
                          </InputLabel_1.default>
                          <Select_1.default labelId="gpu-vendor-select-label" value={field.value || ""} onChange={function (event) {
                                field.onChange(event);
                                setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".name"), "");
                                setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".memory"), "");
                                setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".interface"), "");
                            }} variant="outlined" label="Vendor" fullWidth size="small" MenuProps={{ disableScrollLock: true }}>
                            {gpuVendors.map(function (u) { return (<MenuItem_1.default key={u.id} value={u.value}>
                                {u.value}
                              </MenuItem_1.default>); })}
                          </Select_1.default>
                        </FormControl_1.default>);
                    }}/>
                  </div>
                  {gpuModels ? (<>
                      <div className="col-span-3">
                        <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".name")} render={function (_a) {
                            var _b;
                            var field = _a.field;
                            return (<FormControl_1.default fullWidth>
                              <InputLabel_1.default id="gpu-model-select-label" size="small">
                                Model
                              </InputLabel_1.default>
                              <Select_1.default labelId="gpu-model-select-label" value={field.value || ""} onChange={function (event) {
                                    field.onChange(event);
                                    setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".memory"), theOnlyForModelOrEmpty(event.target.value, "memory"));
                                    setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".interface"), theOnlyForModelOrEmpty(event.target.value, "interface"));
                                }} variant="outlined" size="small" label="Model" fullWidth IconComponent={(((_b = field.value) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0
                                    ? function () { return (<IconButton_1.default size="small" onClick={function () {
                                            field.onChange("");
                                            setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".memory"), "");
                                            setValue("services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".interface"), "");
                                        }}>
                                          <iconoir_react_1.Xmark className="text-xs"/>
                                        </IconButton_1.default>); }
                                    : undefined} MenuProps={{ disableScrollLock: true }}>
                                {models.map(function (gpu) { return (<MenuItem_1.default key={gpu.name} value={gpu.name}>
                                    {gpu.name}
                                  </MenuItem_1.default>); })}
                              </Select_1.default>
                            </FormControl_1.default>);
                        }}/>
                      </div>
                      <div className="col-span-3">
                        <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".memory")} render={function (_a) {
                            var _b;
                            var field = _a.field;
                            return (<FormControl_1.default fullWidth>
                              <InputLabel_1.default id="gpu-memory-select-label" size="small">
                                Memory
                              </InputLabel_1.default>
                              <Select_1.default labelId="gpu-memory-select-label" value={field.value || ""} onChange={field.onChange} variant="outlined" size="small" disabled={!(currentGpu === null || currentGpu === void 0 ? void 0 : currentGpu.name)} label="Memory" fullWidth IconComponent={(((_b = field.value) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0
                                    ? function () { return (<IconButton_1.default size="small" onClick={function () {
                                            field.onChange("");
                                        }}>
                                          <iconoir_react_1.Xmark fontSize="small"/>
                                        </IconButton_1.default>); }
                                    : undefined} MenuProps={{ disableScrollLock: true }}>
                                {memorySizes.map(function (x) { return (<MenuItem_1.default key={x} value={x}>
                                    {x}
                                  </MenuItem_1.default>); })}
                              </Select_1.default>
                            </FormControl_1.default>);
                        }}/>
                      </div>
                      <div className="col-span-3">
                        <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.gpuModels.").concat(formGpuIndex, ".interface")} render={function (_a) {
                            var _b;
                            var field = _a.field;
                            return (<FormControl_1.default fullWidth>
                              <InputLabel_1.default id="gpu-interface-select-label" size="small">
                                Interface
                              </InputLabel_1.default>
                              <Select_1.default labelId="gpu-interface-select-label" value={field.value || ""} onChange={field.onChange} variant="outlined" size="small" disabled={!(currentGpu === null || currentGpu === void 0 ? void 0 : currentGpu.name)} label="Interface" fullWidth IconComponent={(((_b = field.value) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0
                                    ? function () { return (<IconButton_1.default size="small" onClick={function () {
                                            field.onChange("");
                                        }}>
                                          <iconoir_react_1.Xmark fontSize="small"/>
                                        </IconButton_1.default>); }
                                    : undefined} MenuProps={{ disableScrollLock: true }}>
                                {interfaces.map(function (x) { return (<MenuItem_1.default key={x} value={x}>
                                    {x}
                                  </MenuItem_1.default>); })}
                              </Select_1.default>
                            </FormControl_1.default>);
                        }}/>
                      </div>

                      <div className="col-span-1 flex items-center justify-center">
                        {formGpuIndex !== 0 && (<components_1.Button onClick={function () { return removeFormGpuModel(formGpuIndex); }} size="icon" type="button" variant="ghost">
                            <iconoir_react_1.Bin />
                          </components_1.Button>)}
                      </div>
                    </>) : (<div className="ml-4 flex items-center">
                      <components_1.Spinner />
                      <span className="ml-2 whitespace-nowrap text-sm text-muted-foreground">Loading GPU models...</span>
                    </div>)}
                </div>
              </div>);
            })}
        </>)}

      {gpuModels && hasGpu && (<div className="mt-2 flex items-center justify-end">
          <components_1.Button size="sm" onClick={onAddGpuModel} type="button">
            Add GPU
          </components_1.Button>
        </div>)}
    </FormPaper_1.FormPaper>);
};
exports.GpuFormControl = GpuFormControl;
