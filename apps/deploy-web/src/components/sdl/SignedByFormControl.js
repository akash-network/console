"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedByFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var FormPaper_1 = require("./FormPaper");
exports.SignedByFormControl = (0, react_1.forwardRef)(function (_a, ref) {
    var _b, _c;
    var control = _a.control, serviceIndex = _a.serviceIndex, _d = _a.signedByAnyOf, _signedByAnyOf = _d === void 0 ? [] : _d, _e = _a.signedByAllOf, _signedByAllOf = _e === void 0 ? [] : _e;
    var _f = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".placement.signedBy.anyOf"),
        keyName: "id"
    }), signedByAnyOf = _f.fields, removeAnyOf = _f.remove, appendAnyOf = _f.append;
    var _g = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".placement.signedBy.allOf"),
        keyName: "id"
    }), signedByAllOf = _g.fields, removeAllOf = _g.remove, appendAllOf = _g.append;
    var onAddSignedAnyOf = function () {
        appendAnyOf({ id: (0, nanoid_1.nanoid)(), value: "" });
    };
    var onAddSignedAllOf = function () {
        appendAllOf({ id: (0, nanoid_1.nanoid)(), value: "" });
    };
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        _removeSignedByAnyOf: function (index) {
            removeAnyOf(index);
        },
        _removeSignedByAllOf: function (index) {
            removeAllOf(index);
        }
    }); });
    return (<FormPaper_1.FormPaper className="h-full">
        <div className="mb-4 flex items-center">
          <strong className="text-sm">Signed By</strong>

          <components_1.CustomTooltip title={<>
                This will filter bids based on which address (auditor) audited the provider.
                <br />
                <br />
                This allows for requiring a third-party certification of any provider that you deploy to.
                <br />
                <br />
                <a href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacementsignedby" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>}>
            <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
          </components_1.CustomTooltip>
        </div>

        <div className={(0, utils_1.cn)("flex items-start justify-between", (_b = {}, _b["mb-4"] = !!_signedByAnyOf.length, _b))}>
          <div className="flex items-center">
            <strong className="text-sm">Any of</strong>
            <components_1.CustomTooltip title={<>Filter providers that have been audited by ANY of these accounts.</>}>
              <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
            </components_1.CustomTooltip>
          </div>

          <components_1.Button variant="default" size="sm" onClick={onAddSignedAnyOf}>
            Add Any Of
          </components_1.Button>
        </div>

        <div className="mb-4">
          {signedByAnyOf.length > 0 ? (signedByAnyOf.map(function (anyOf, anyOfIndex) {
            var _a;
            return (<div key={anyOf.id} className={(0, utils_1.cn)((_a = {}, _a["mb-4"] = anyOfIndex + 1 === _signedByAnyOf.length, _a["mb-2"] = anyOfIndex + 1 !== _signedByAnyOf.length, _a))}>
                  <div className="flex items-end">
                    <div className="flex-grow">
                      {/** TODO Add list of auditors */}
                      <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.signedBy.anyOf.").concat(anyOfIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label="Value" value={field.value} className="w-full" onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
                    </div>

                    <div className="pl-2">
                      <components_1.Button onClick={function () { return removeAnyOf(anyOfIndex); }} size="icon" variant="ghost">
                        <iconoir_react_1.Bin />
                      </components_1.Button>
                    </div>
                  </div>
                </div>);
        })) : (<div className="text-xs text-muted-foreground">None</div>)}
        </div>

        <div className={(0, utils_1.cn)("flex items-start justify-between", (_c = {}, _c["mb-4"] = !!_signedByAllOf.length, _c))}>
          <div className="flex items-center">
            <strong className="text-sm">All of</strong>
            <components_1.CustomTooltip title={<>Filter providers that have been audited by ALL of these accounts.</>}>
              <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
            </components_1.CustomTooltip>
          </div>

          <components_1.Button color="primary" variant="default" size="sm" onClick={onAddSignedAllOf}>
            Add All Of
          </components_1.Button>
        </div>

        {signedByAllOf.length > 0 ? (signedByAllOf.map(function (allOf, allOfIndex) {
            var _a;
            return (<div key={allOf.id} className={(0, utils_1.cn)((_a = {}, _a["mb-2"] = allOfIndex + 1 !== _signedByAllOf.length, _a))}>
                <div className="flex items-end">
                  <div className="flex-grow">
                    {/** TODO Add list of auditors */}
                    <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.signedBy.allOf.").concat(allOfIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<components_1.FormInput type="text" label="Value" className="w-full" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
                }}/>
                  </div>

                  <div className="pl-2">
                    <components_1.Button onClick={function () { return removeAllOf(allOfIndex); }} size="icon" variant="ghost">
                      <iconoir_react_1.Bin />
                    </components_1.Button>
                  </div>
                </div>
              </div>);
        })) : (<div className="text-xs text-muted-foreground">None</div>)}
      </FormPaper_1.FormPaper>);
});
