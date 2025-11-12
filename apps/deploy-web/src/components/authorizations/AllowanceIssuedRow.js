"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowanceIssuedRow = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var AKTAmount_1 = require("@src/components/shared/AKTAmount");
var grants_1 = require("@src/utils/grants");
var priceUtils_1 = require("@src/utils/priceUtils");
var AllowanceIssuedRow = function (_a) {
    var _b, _c;
    var allowance = _a.allowance, checked = _a.checked, onEditAllowance = _a.onEditAllowance, setDeletingAllowance = _a.setDeletingAllowance, onSelectAllowance = _a.onSelectAllowance;
    var limit = (_c = (_b = allowance === null || allowance === void 0 ? void 0 : allowance.allowance) === null || _b === void 0 ? void 0 : _b.spend_limit) === null || _c === void 0 ? void 0 : _c[0];
    return (<components_1.TableRow className="[&>td]:px-2 [&>td]:py-1">
      <components_1.TableCell>{(0, grants_1.getAllowanceTitleByType)(allowance)}</components_1.TableCell>
      <components_1.TableCell align="center">
        <components_1.Address address={allowance.grantee} isCopyable/>
      </components_1.TableCell>
      <components_1.TableCell align="center">
        {limit ? (<>
            <AKTAmount_1.AKTAmount uakt={(0, priceUtils_1.coinToUDenom)(limit)}/> AKT
          </>) : (<span>Unlimited</span>)}
      </components_1.TableCell>
      <components_1.TableCell align="center">
        <react_intl_1.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration}/>
      </components_1.TableCell>
      <components_1.TableCell align="center">
        <div className="flex items-center justify-end space-x-2">
          <div className="flex w-[40px] items-center justify-center">
            <components_1.Checkbox checked={checked} onClick={function (event) {
            event.stopPropagation();
        }} onCheckedChange={function (value) {
            onSelectAllowance(value, allowance);
        }}/>
          </div>
          <components_1.Button variant="ghost" size="icon" onClick={function () { return onEditAllowance(allowance); }} aria-label="Edit Authorization">
            <iconoir_react_1.Edit className="text-xs"/>
          </components_1.Button>
          <components_1.Button variant="ghost" size="icon" onClick={function () { return setDeletingAllowance(allowance); }} aria-label="Revoke Authorization">
            <iconoir_react_1.Bin className="text-xs"/>
          </components_1.Button>
        </div>
      </components_1.TableCell>
    </components_1.TableRow>);
};
exports.AllowanceIssuedRow = AllowanceIssuedRow;
