"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityIcon = void 0;
var Battery0Bar_1 = require("@mui/icons-material/Battery0Bar");
var Battery1Bar_1 = require("@mui/icons-material/Battery1Bar");
var Battery2Bar_1 = require("@mui/icons-material/Battery2Bar");
var Battery3Bar_1 = require("@mui/icons-material/Battery3Bar");
var Battery4Bar_1 = require("@mui/icons-material/Battery4Bar");
var Battery5Bar_1 = require("@mui/icons-material/Battery5Bar");
var Battery6Bar_1 = require("@mui/icons-material/Battery6Bar");
var BatteryFull_1 = require("@mui/icons-material/BatteryFull");
var BatteryUnknown_1 = require("@mui/icons-material/BatteryUnknown");
var CapacityIcon = function (_a) {
    var value = _a.value, _b = _a.fontSize, fontSize = _b === void 0 ? "medium" : _b;
    if (value === 0)
        return <Battery0Bar_1.default color="disabled" fontSize={fontSize}/>;
    else if (value < 0.16)
        return <Battery1Bar_1.default color="disabled" fontSize={fontSize}/>;
    else if (value < 0.32)
        return <Battery2Bar_1.default color="disabled" fontSize={fontSize}/>;
    else if (value < 0.48)
        return <Battery3Bar_1.default color="primary" className="opacity-60" fontSize={fontSize}/>;
    else if (value < 0.64)
        return <Battery4Bar_1.default color="primary" className="opacity-60" fontSize={fontSize}/>;
    else if (value < 0.8)
        return <Battery5Bar_1.default color="primary" className="opacity-80" fontSize={fontSize}/>;
    else if (value < 1)
        return <Battery6Bar_1.default color="primary" fontSize={fontSize}/>;
    else if (value === 1)
        return <BatteryFull_1.default color="primary" fontSize={fontSize}/>;
    return <BatteryUnknown_1.default color="disabled" fontSize={fontSize}/>;
};
exports.CapacityIcon = CapacityIcon;
