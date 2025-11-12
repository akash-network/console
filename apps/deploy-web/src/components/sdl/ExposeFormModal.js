"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExposeFormModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var data_1 = require("@src/utils/sdl/data");
var AcceptFormControl_1 = require("./AcceptFormControl");
var FormPaper_1 = require("./FormPaper");
var HttpOptionsFormControl_1 = require("./HttpOptionsFormControl");
var ToFormControl_1 = require("./ToFormControl");
var ExposeFormModal = function (_a) {
    var control = _a.control, serviceIndex = _a.serviceIndex, onClose = _a.onClose, _expose = _a.expose, services = _a.services;
    var acceptRef = (0, react_1.useRef)(null);
    var toRef = (0, react_1.useRef)(null);
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".expose"),
        keyName: "id"
    }), expose = _b.fields, removeExpose = _b.remove, appendExpose = _b.append;
    var onAddExpose = function () {
        appendExpose({ id: (0, nanoid_1.nanoid)(), port: 80, as: 80, global: true });
    };
    var _onClose = function () {
        var _a, _b;
        var acceptToRemove = [];
        var toToRemove = [];
        _expose.forEach(function (e) {
            var _a, _b;
            (_a = e.accept) === null || _a === void 0 ? void 0 : _a.forEach(function (a, ii) {
                if (!a.value.trim()) {
                    acceptToRemove.push(ii);
                }
            });
            (_b = e.to) === null || _b === void 0 ? void 0 : _b.forEach(function (a, ii) {
                if (!a.value.trim()) {
                    toToRemove.push(ii);
                }
            });
        });
        (_a = acceptRef.current) === null || _a === void 0 ? void 0 : _a._removeAccept(acceptToRemove);
        (_b = toRef.current) === null || _b === void 0 ? void 0 : _b._removeTo(toToRemove);
        onClose();
    };
    return (<components_1.Popup fullWidth open variant="custom" title={<div className="flex items-center">
          Edit Port Expose
          <components_1.CustomTooltip title={<>
                Expose is a list of settings describing what can connect to the service.
                <br />
                <br />
                Map container ports to exposed http/https/tcp ports.
                <br />
                <br />
                <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>}>
            <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
          </components_1.CustomTooltip>
        </div>} actions={[
            {
                label: "Close",
                color: "secondary",
                variant: "ghost",
                side: "left",
                onClick: _onClose
            },
            {
                label: "Add Expose",
                color: "primary",
                variant: "default",
                side: "right",
                onClick: onAddExpose
            }
        ]} onClose={_onClose} maxWidth="xl" enableCloseOnBackdropClick>
      {expose.map(function (exp, expIndex) {
            var _a;
            var currentExpose = _expose[expIndex];
            return (<FormPaper_1.FormPaper key={exp.id} className={(0, utils_1.cn)("bg-popover", (_a = {}, _a["mb-4"] = expIndex + 1 !== expose.length, _a))} contentClassName="flex">
            <div className="flex-grow">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <div>
                  <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(expIndex, ".port")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                            Port
                            <components_1.CustomTooltip title={<>Container port to expose.</>}>
                              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                            </components_1.CustomTooltip>
                          </div>} min={1} max={65535} step={1} value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }}/>);
                }}/>
                </div>
                <div>
                  <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(expIndex, ".as")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                            As
                            <components_1.CustomTooltip title={<>Port number to expose the container port as.</>}>
                              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                            </components_1.CustomTooltip>
                          </div>} color="secondary" value={field.value} onChange={function (event) { return field.onChange(parseInt(event.target.value)); }}/>);
                }}/>
                </div>
                <div>
                  <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(expIndex, ".proto")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormItem>
                        <components_1.FormLabel>Protocol</components_1.FormLabel>
                        <components_1.Select value={field.value || ""} onValueChange={field.onChange}>
                          <components_1.SelectTrigger>
                            <components_1.SelectValue placeholder="Select protocol"/>
                          </components_1.SelectTrigger>
                          <components_1.SelectContent>
                            <components_1.SelectGroup>
                              {data_1.protoTypes.map(function (t) {
                            return (<components_1.SelectItem key={t.id} value={t.name}>
                                    {t.name}
                                  </components_1.SelectItem>);
                        })}
                            </components_1.SelectGroup>
                          </components_1.SelectContent>
                        </components_1.Select>
                        <components_1.FormMessage />
                      </components_1.FormItem>);
                }}/>
                </div>

                <div>
                  <div className="flex h-full items-start">
                    <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".expose.").concat(expIndex, ".global")} render={function (_a) {
                    var field = _a.field;
                    return (<div className="flex items-center space-x-2">
                          <components_1.Checkbox id={"global-".concat(serviceIndex, "-").concat(expIndex)} checked={field.value} onCheckedChange={field.onChange}/>
                          <label htmlFor={"global-".concat(serviceIndex, "-").concat(expIndex)} className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Global
                          </label>
                        </div>);
                }}/>

                    <components_1.CustomTooltip title={<>Check if you want this service to be accessible from outside the datacenter.</>}>
                      <iconoir_react_1.InfoCircle className="ml-4 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <AcceptFormControl_1.AcceptFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} ref={acceptRef} accept={(currentExpose === null || currentExpose === void 0 ? void 0 : currentExpose.accept) || []}/>
                </div>

                <div>
                  <ToFormControl_1.ToFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} ref={toRef} services={services}/>
                </div>
              </div>

              <div className="mb-4">
                <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(expIndex, ".ipName")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label={<div className="inline-flex items-center">
                          IP Name
                          <components_1.CustomTooltip title={<>
                                Optional.
                                <br />
                                <br />
                                Option for Tenants to request publicly routable IP addresses for the services they deploy
                                <br />
                                <br />
                                <a href="https://akash.network/docs/network-features/ip-leases/" target="_blank" rel="noopener">
                                  View official documentation.
                                </a>
                              </>}>
                            <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                          </components_1.CustomTooltip>
                        </div>} color="secondary" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
              </div>

              <div>
                <HttpOptionsFormControl_1.HttpOptionsFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} services={services}/>
              </div>
            </div>

            {expIndex !== 0 && (<div className="pl-2">
                <components_1.Button onClick={function () { return removeExpose(expIndex); }} size="icon" variant="ghost">
                  <iconoir_react_1.Bin />
                </components_1.Button>
              </div>)}
          </FormPaper_1.FormPaper>);
        })}
    </components_1.Popup>);
};
exports.ExposeFormModal = ExposeFormModal;
