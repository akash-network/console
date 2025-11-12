"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseSelect = void 0;
var react_1 = require("react");
var FormControl_1 = require("@mui/material/FormControl");
var InputLabel_1 = require("@mui/material/InputLabel");
var MenuItem_1 = require("@mui/material/MenuItem");
var Select_1 = require("@mui/material/Select");
var LeaseSelect = function (_a) {
    var defaultValue = _a.defaultValue, leases = _a.leases, onSelectedChange = _a.onSelectedChange;
    var _b = (0, react_1.useState)(defaultValue), selected = _b[0], setSelected = _b[1];
    var handleChange = function (event) {
        var value = event.target.value;
        setSelected(value);
        onSelectedChange(value);
    };
    return (<FormControl_1.default className="w-auto min-w-[150px]">
      <InputLabel_1.default id="lease-select-label">Lease</InputLabel_1.default>
      <Select_1.default labelId="lease-select-label" label="Lease" value={selected} onChange={handleChange} variant="outlined" classes={{
            select: "py-2 px-4 text-xs"
        }}>
        {leases.map(function (l) { return (<MenuItem_1.default key={l.id} value={l.id} dense>
            <p className="leading-4">GSEQ: {l.gseq}</p>
          </MenuItem_1.default>); })}
      </Select_1.default>
    </FormControl_1.default>);
};
exports.LeaseSelect = LeaseSelect;
