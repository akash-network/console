"use strict";
"use client";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionSelect = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var Autocomplete_1 = require("@mui/material/Autocomplete");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var TextField_1 = require("@mui/material/TextField");
var iconoir_react_1 = require("iconoir-react");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var RegionSelect = function (_a) {
    var control = _a.control, className = _a.className;
    var _b = (0, react_1.useState)(false), isOpen = _b[0], setIsOpen = _b[1];
    var _c = (0, useProvidersQuery_1.useProviderRegions)(), regions = _c.data, isLoadingRegions = _c.isLoading;
    var options = __spreadArray([
        {
            key: "any",
            description: "Any region",
            providers: []
        }
    ], (regions || []), true);
    return (<react_hook_form_1.Controller control={control} name={"region"} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<div className={(0, utils_1.cn)(className, "flex items-center")}>
          <Autocomplete_1.default disableClearable open={isOpen} options={options} value={field.value} getOptionLabel={function (option) { return option === null || option === void 0 ? void 0 : option.key; }} defaultValue={undefined} isOptionEqualToValue={function (option, value) { return option.key === value.key; }} filterSelectedOptions fullWidth loading={isLoadingRegions} ChipProps={{ size: "small" }} onChange={function (event, newValue) {
                    field.onChange(newValue);
                }} renderInput={function (params) {
                    var _a;
                    return (<ClickAwayListener_1.default onClickAway={function () { return setIsOpen(false); }}>
                <TextField_1.default {...params} label="Region" variant="outlined" color="secondary" size="small" error={!!fieldState.error} helperText={(_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message} onClick={function () { return setIsOpen(function (prev) { return !prev; }); }} sx={{ minHeight: "42px" }}/>
              </ClickAwayListener_1.default>);
                }} renderOption={function (props, option) {
                    var _a, _b;
                    var _c, _d;
                    return (<li {...props} className={(0, utils_1.cn)("flex w-full items-center px-2 py-1", (_a = {}, _a["pointer-events-none cursor-default text-muted-foreground/50"] = option.key !== "any" && ((_c = option.providers) === null || _c === void 0 ? void 0 : _c.length) === 0, _a), props.className)}>
                  <span>{option.key}</span>
                  {option.key !== "any" && (<small className={(0, utils_1.cn)("ml-2", (_b = {}, _b["font-bold text-primary"] = ((_d = option.providers) === null || _d === void 0 ? void 0 : _d.length) > 0, _b))}>({option.providers.length})</small>)}
                  <components_1.CustomTooltip title={option.description}>
                    <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                  </components_1.CustomTooltip>
                </li>);
                }}/>
        </div>);
        }}/>);
};
exports.RegionSelect = RegionSelect;
