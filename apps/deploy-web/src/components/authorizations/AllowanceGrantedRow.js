"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowanceGrantedRow = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var AKTAmount_1 = require("@src/components/shared/AKTAmount");
var grants_1 = require("@src/utils/grants");
var priceUtils_1 = require("@src/utils/priceUtils");
var AllowanceGrantedRow = function (_a) {
    var _b, _c;
    var allowance = _a.allowance, selected = _a.selected, onSelect = _a.onSelect;
    var limit = (_c = (_b = allowance === null || allowance === void 0 ? void 0 : allowance.allowance) === null || _b === void 0 ? void 0 : _b.spend_limit) === null || _c === void 0 ? void 0 : _c[0];
    return (<components_1.TableRow className="[&>td]:px-2 [&>td]:py-1">
      <components_1.TableCell>
        <components_1.Checkbox className="ml-2" checked={selected} onCheckedChange={typeof onSelect === "function" ? function (checked) { return checked && onSelect(); } : undefined}/>
      </components_1.TableCell>
      <components_1.TableCell>{(0, grants_1.getAllowanceTitleByType)(allowance)}</components_1.TableCell>
      <components_1.TableCell>{allowance.granter && <components_1.Address address={allowance.granter} isCopyable/>}</components_1.TableCell>
      <components_1.TableCell>
        {limit ? (<>
            <AKTAmount_1.AKTAmount uakt={(0, priceUtils_1.coinToUDenom)(limit)}/> AKT
          </>) : (<span>Unlimited</span>)}
      </components_1.TableCell>
      <components_1.TableCell align="right">{<react_intl_1.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration}/>}</components_1.TableCell>
    </components_1.TableRow>);
};
exports.AllowanceGrantedRow = AllowanceGrantedRow;
