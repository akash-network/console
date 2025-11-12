"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var FormPaper_1 = require("./FormPaper");
exports.ToFormControl = (0, react_1.forwardRef)(function (_a, ref) {
    var control = _a.control, serviceIndex = _a.serviceIndex, exposeIndex = _a.exposeIndex, services = _a.services;
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".to"),
        keyName: "id"
    }), accept = _b.fields, removeTo = _b.remove, appendTo = _b.append;
    var currentService = services[serviceIndex];
    var otherServices = services.filter(function (s) { return (currentService === null || currentService === void 0 ? void 0 : currentService.id) !== s.id; });
    var onAddTo = function () {
        appendTo({ id: (0, nanoid_1.nanoid)(), value: "" });
    };
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        _removeTo: function (index) {
            removeTo(index);
        }
    }); });
    return (<FormPaper_1.FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="mb-4 flex items-center">
            <strong className="text-sm">To</strong>

            <components_1.CustomTooltip title={<>
                  List of entities allowed to connect.
                  <br />
                  <br />
                  If the service is marked as global, it will allow connections from outside the datacenter.
                  <br />
                  <br />
                  <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexposeto" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>}>
              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
            </components_1.CustomTooltip>
          </div>
        </div>

        {accept.map(function (acc, accIndex) {
            var _a;
            return (<div key={acc.id} className={(0, utils_1.cn)((_a = {}, _a["mb-2"] = accIndex + 1 !== accept.length, _a))}>
              <div className="flex items-end">
                <div className="flex-grow">
                  <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".to.").concat(accIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.Select value={field.value || ""} onValueChange={field.onChange}>
                        <components_1.SelectTrigger>
                          <components_1.SelectValue placeholder="Select network"/>
                        </components_1.SelectTrigger>
                        <components_1.SelectContent>
                          <components_1.SelectGroup>
                            {otherServices.map(function (t) {
                            return (<components_1.SelectItem key={t.id} value={t.title}>
                                  {t.title}
                                </components_1.SelectItem>);
                        })}
                          </components_1.SelectGroup>
                        </components_1.SelectContent>
                      </components_1.Select>);
                }}/>
                </div>

                <div className="pl-2">
                  <components_1.Button onClick={function () { return removeTo(accIndex); }} size="icon" variant="ghost">
                    <iconoir_react_1.Bin />
                  </components_1.Button>
                </div>
              </div>
            </div>);
        })}

        {otherServices.length === 0 && <div className="mb-4 text-xs text-muted-foreground">There's no other service to expose to.</div>}
      </div>

      <div className="flex items-center">
        <components_1.Button variant="default" size="sm" onClick={onAddTo} disabled={otherServices.length === 0}>
          Add To
        </components_1.Button>
      </div>
    </FormPaper_1.FormPaper>);
});
