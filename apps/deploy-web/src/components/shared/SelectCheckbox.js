"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectCheckbox = void 0;
var components_1 = require("@akashnetwork/ui/components");
var FormControl_1 = require("@mui/material/FormControl");
var InputLabel_1 = require("@mui/material/InputLabel");
var ListItemIcon_1 = require("@mui/material/ListItemIcon");
var ListItemText_1 = require("@mui/material/ListItemText");
var MenuItem_1 = require("@mui/material/MenuItem");
var Select_1 = require("@mui/material/Select");
var ITEM_HEIGHT = 48;
var ITEM_PADDING_TOP = 8;
var MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250
        }
    },
    getContentAnchorEl: null,
    anchorOrigin: {
        vertical: "bottom",
        horizontal: "center"
    },
    transformOrigin: {
        vertical: "top",
        horizontal: "center"
    }
    // variant: "menu"
};
var SelectCheckbox = function (_a) {
    var _b = _a.selected, selected = _b === void 0 ? [] : _b, options = _a.options, onSelectedChange = _a.onSelectedChange, label = _a.label, disabled = _a.disabled, placeholder = _a.placeholder;
    var isAllSelected = options.length > 0 && selected.length === options.length;
    var handleChange = function (event) {
        var value = event.target.value;
        var newValue = value;
        if (value[value.length - 1] === "all") {
            newValue = selected.length === options.length ? [] : options;
        }
        onSelectedChange === null || onSelectedChange === void 0 ? void 0 : onSelectedChange(newValue);
    };
    return (<FormControl_1.default className="w-auto min-w-[150px]">
      <InputLabel_1.default id="mutiple-select-label" shrink={!!placeholder}>
        {label}
      </InputLabel_1.default>
      <Select_1.default labelId="mutiple-select-label" multiple label={label} value={selected} onChange={handleChange} renderValue={function (selected) { return selected.join(", ") || placeholder; }} displayEmpty={true} size="small" MenuProps={MenuProps} disabled={disabled} variant="outlined" notched={!!placeholder} classes={{
            select: "py-2 px-4 text-xs"
        }}>
        <MenuItem_1.default value="all" classes={{
            root: isAllSelected ? "bg-secondary" : ""
        }}>
          <ListItemIcon_1.default>
            <components_1.Checkbox checked={isAllSelected}/>
          </ListItemIcon_1.default>
          <ListItemText_1.default classes={{ primary: "font-normal" }} primary="Select All"/>
        </MenuItem_1.default>
        {options.map(function (option) { return (<MenuItem_1.default key={option} value={option}>
            <ListItemIcon_1.default>
              <components_1.Checkbox checked={selected.includes(option)}/>
            </ListItemIcon_1.default>
            <ListItemText_1.default primary={option}/>
          </MenuItem_1.default>); })}
      </Select_1.default>
    </FormControl_1.default>);
};
exports.SelectCheckbox = SelectCheckbox;
