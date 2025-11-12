"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlacementFormModal = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var denom_config_1 = require("@src/config/denom.config");
var useDenom_1 = require("@src/hooks/useDenom");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var PriceValue_1 = require("../shared/PriceValue");
var UsdLabel_1 = require("../shared/UsdLabel");
var AttributesFormControl_1 = require("./AttributesFormControl");
var FormPaper_1 = require("./FormPaper");
var SignedByFormControl_1 = require("./SignedByFormControl");
var PlacementFormModal = function (_a) {
    var _b, _c;
    var control = _a.control, services = _a.services, serviceIndex = _a.serviceIndex, onClose = _a.onClose, _placement = _a.placement;
    var signedByRef = (0, react_1.useRef)(null);
    var attritubesRef = (0, react_1.useRef)(null);
    var supportedSdlDenoms = (0, useDenom_1.useSdlDenoms)();
    var currentService = services[serviceIndex];
    var selectedDenom = supportedSdlDenoms.find(function (x) { return x.value === currentService.placement.pricing.denom; });
    var _onClose = function () {
        var _a, _b, _c, _d, _e, _f;
        var attributesToRemove = [];
        var signedByAnyToRemove = [];
        var signedByAllToRemove = [];
        (_a = _placement.attributes) === null || _a === void 0 ? void 0 : _a.forEach(function (e, i) {
            if (!e.key.trim() || !e.value.trim()) {
                attributesToRemove.push(i);
            }
        });
        (_b = _placement.signedBy) === null || _b === void 0 ? void 0 : _b.anyOf.forEach(function (e, i) {
            if (!e.value.trim()) {
                signedByAnyToRemove.push(i);
            }
        });
        (_c = _placement.signedBy) === null || _c === void 0 ? void 0 : _c.allOf.forEach(function (e, i) {
            if (!e.value.trim()) {
                signedByAllToRemove.push(i);
            }
        });
        (_d = attritubesRef.current) === null || _d === void 0 ? void 0 : _d._removeAttribute(attributesToRemove);
        (_e = signedByRef.current) === null || _e === void 0 ? void 0 : _e._removeSignedByAnyOf(signedByAnyToRemove);
        (_f = signedByRef.current) === null || _f === void 0 ? void 0 : _f._removeSignedByAllOf(signedByAllToRemove);
        onClose();
    };
    return (<components_1.Popup fullWidth open variant="custom" title="Edit placement" actions={[
            {
                label: "Done",
                color: "secondary",
                variant: "ghost",
                side: "right",
                onClick: _onClose
            }
        ]} onClose={_onClose} maxWidth="xl" enableCloseOnBackdropClick>
      <FormPaper_1.FormPaper contentClassName="flex">
        <div className="flex-grow">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.name")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="text" label={<div className="flex items-center">
                        Name
                        <components_1.CustomTooltip title={<>The name of the placement.</>}>
                          <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
                        </components_1.CustomTooltip>
                      </div>} value={field.value} onChange={function (event) { return field.onChange(event.target.value); }}/>);
        }}/>
            </div>

            <div>
              <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".placement.pricing.amount")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="number" label={<div className="flex items-center">
                        Pricing, ${(0, priceUtils_1.toReadableDenom)(currentService.placement.pricing.denom)}
                        <components_1.CustomTooltip title={<>
                              The maximum amount of {selectedDenom === null || selectedDenom === void 0 ? void 0 : selectedDenom.label} you're willing to pay per block (~6 seconds).
                              <br />
                              <br />
                              Akash will only show providers costing <strong>less</strong> than{" "}
                              <strong>
                                {(selectedDenom === null || selectedDenom === void 0 ? void 0 : selectedDenom.value) === denom_config_1.UAKT_DENOM ? (<>
                                    ~<PriceValue_1.PriceValue denom={denom_config_1.UAKT_DENOM} value={(0, priceUtils_1.getAvgCostPerMonth)((0, priceUtils_1.uaktToAKT)(_placement.pricing.amount))}/>
                                  </>) : (<>
                                    <span>
                                      <react_intl_1.FormattedNumber value={(0, priceUtils_1.getAvgCostPerMonth)((0, mathHelpers_1.udenomToDenom)(_placement.pricing.amount))} maximumFractionDigits={2}/>
                                    </span>
                                    <UsdLabel_1.USDLabel />
                                  </>)}
                              </strong>
                              &nbsp;per month
                            </>}>
                          <iconoir_react_1.InfoCircle className="ml-2 text-sm text-muted-foreground"/>
                        </components_1.CustomTooltip>
                      </div>} value={field.value} min={1} step={1} max={10000000} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }}/>);
        }}/>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SignedByFormControl_1.SignedByFormControl control={control} serviceIndex={serviceIndex} signedByAnyOf={((_b = _placement.signedBy) === null || _b === void 0 ? void 0 : _b.anyOf) || []} signedByAllOf={((_c = _placement.signedBy) === null || _c === void 0 ? void 0 : _c.allOf) || []} ref={signedByRef}/>
            </div>

            <div>
              <AttributesFormControl_1.AttributesFormControl control={control} serviceIndex={serviceIndex} attributes={_placement.attributes || []} ref={attritubesRef}/>
            </div>
          </div>
        </div>
      </FormPaper_1.FormPaper>
    </components_1.Popup>);
};
exports.PlacementFormModal = PlacementFormModal;
