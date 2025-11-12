"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceSelect = void 0;
var react_1 = require("react");
var FormControl_1 = require("@mui/material/FormControl");
var InputLabel_1 = require("@mui/material/InputLabel");
var MenuItem_1 = require("@mui/material/MenuItem");
var Select_1 = require("@mui/material/Select");
var ServiceSelect = function (_a) {
    var defaultValue = _a.defaultValue, services = _a.services, onSelectedChange = _a.onSelectedChange;
    var _b = (0, react_1.useState)(defaultValue), selected = _b[0], setSelected = _b[1];
    var handleChange = function (event) {
        var value = event.target.value;
        setSelected(value);
        onSelectedChange(value);
    };
    return (<FormControl_1.default className="w-auto min-w-[150px]">
      <InputLabel_1.default id="service-select-label">Services</InputLabel_1.default>
      <Select_1.default labelId="service-select-label" value={selected} onChange={handleChange} variant="outlined" size="small" label="Services" classes={{
            select: "py-2 px-4 text-xs"
        }}>
        {services.map(function (service) { return (<MenuItem_1.default key={service} value={service} dense>
            <span className="text-sm text-muted-foreground">{service}</span>
          </MenuItem_1.default>); })}
      </Select_1.default>
    </FormControl_1.default>);
};
exports.ServiceSelect = ServiceSelect;
