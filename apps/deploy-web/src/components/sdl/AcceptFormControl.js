"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcceptFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var FormPaper_1 = require("./FormPaper");
exports.AcceptFormControl = (0, react_1.forwardRef)(function (_a, ref) {
    var _b;
    var control = _a.control, serviceIndex = _a.serviceIndex, exposeIndex = _a.exposeIndex, _accept = _a.accept;
    var _c = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".accept"),
        keyName: "id"
    }), accept = _c.fields, removeAccept = _c.remove, appendAccept = _c.append;
    var onAddAccept = function () {
        appendAccept({ id: (0, nanoid_1.nanoid)(), value: "" });
    };
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        _removeAccept: function (index) {
            removeAccept(index);
        }
    }); });
    return (<FormPaper_1.FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div className="mb-4 flex items-center">
        <strong className="text-sm">Accept</strong>

        <components_1.CustomTooltip title={<>List of hosts/domains to accept connections for.</>}>
          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
        </components_1.CustomTooltip>
      </div>

      {accept.map(function (acc, accIndex) {
            var _a;
            return (<div key={acc.id} className={(0, utils_1.cn)("w-full", (_a = {}, _a["mb-2"] = accIndex + 1 !== accept.length, _a))}>
            <div className="flex items-end">
              <div className="flex-grow">
                <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".expose.").concat(exposeIndex, ".accept.").concat(accIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label="Value" color="secondary" placeholder="example.com" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
              </div>

              <div className="pl-2">
                <components_1.Button onClick={function () { return removeAccept(accIndex); }} size="icon" variant="ghost">
                  <iconoir_react_1.Bin />
                </components_1.Button>
              </div>
            </div>
          </div>);
        })}

      <div className={(0, utils_1.cn)("flex items-center", (_b = {}, _b["mt-4"] = _accept && _accept.length > 0, _b))}>
        <components_1.Button variant="default" size="sm" onClick={onAddAccept}>
          Add Accept
        </components_1.Button>
      </div>
    </FormPaper_1.FormPaper>);
});
