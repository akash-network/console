"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributesFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var FormPaper_1 = require("./FormPaper");
exports.AttributesFormControl = (0, react_1.forwardRef)(function (_a, ref) {
    var _b;
    var control = _a.control, serviceIndex = _a.serviceIndex, _c = _a.attributes, _attributes = _c === void 0 ? [] : _c;
    var _d = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".placement.attributes"),
        keyName: "id"
    }), attributes = _d.fields, removeAttribute = _d.remove, appendAttribute = _d.append;
    var onAddAttribute = function () {
        appendAttribute({ id: (0, nanoid_1.nanoid)(), key: "", value: "" });
    };
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        _removeAttribute: function (index) {
            removeAttribute(index);
        }
    }); });
    return (<FormPaper_1.FormPaper className="h-full">
      <div className={(0, utils_1.cn)("flex items-start justify-between", (_b = {}, _b["mb-4"] = !!_attributes.length, _b))}>
        <div className="flex items-center">
          <strong className="text-sm">Attributes</strong>

          <components_1.CustomTooltip title={<>Filter providers that have these attributes.</>}>
            <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
          </components_1.CustomTooltip>
        </div>

        <components_1.Button variant="default" size="sm" onClick={onAddAttribute}>
          Add Attribute
        </components_1.Button>
      </div>

      {attributes.length > 0 ? (attributes.map(function (att, attIndex) {
            var _a;
            return (<div key={att.id} className={(0, utils_1.cn)((_a = {}, _a["mb-2"] = attIndex + 1 !== _attributes.length, _a))}>
              <div className="flex items-end">
                <div className="flex flex-grow items-center">
                  {/** TODO All list of attribute keys and values from pre-defined provider attributes */}
                  <div>
                    <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.attributes.").concat(attIndex, ".key")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label="Key" className="w-full" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
                  </div>

                  <div className="ml-2">
                    <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.attributes.").concat(attIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label="Value" className="w-full" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
                  </div>
                </div>

                <div className="pl-2">
                  <components_1.Button onClick={function () { return removeAttribute(attIndex); }} size="icon" variant="ghost">
                    <iconoir_react_1.Bin />
                  </components_1.Button>
                </div>
              </div>
            </div>);
        })) : (<div className="mb-2 text-xs text-muted-foreground">None</div>)}
    </FormPaper_1.FormPaper>);
});
