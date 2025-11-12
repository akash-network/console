"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QontoConnector = void 0;
exports.QontoStepIcon = QontoStepIcon;
var react_1 = require("react");
var material_1 = require("@mui/material");
var iconoir_react_1 = require("iconoir-react");
exports.QontoConnector = (0, material_1.styled)(material_1.StepConnector)(function (_a) {
    var _b, _c, _d;
    var theme = _a.theme;
    return (_b = {},
        _b["&.".concat(material_1.stepConnectorClasses.alternativeLabel)] = {
            top: 10,
            left: "calc(-50% + 16px)",
            right: "calc(50% + 16px)"
        },
        _b["&.".concat(material_1.stepConnectorClasses.active)] = (_c = {},
            _c["& .".concat(material_1.stepConnectorClasses.line)] = {
                borderColor: theme.palette.primary.main
            },
            _c),
        _b["&.".concat(material_1.stepConnectorClasses.completed)] = (_d = {},
            _d["& .".concat(material_1.stepConnectorClasses.line)] = {
                borderColor: theme.palette.primary.main
            },
            _d),
        _b);
});
var QontoStepIconRoot = (0, material_1.styled)("div")(function (_a) {
    var theme = _a.theme, ownerState = _a.ownerState;
    return (__assign(__assign({ color: theme.palette.mode === "dark" ? theme.palette.grey[700] : "#eaeaf0", display: "flex", height: 22, alignItems: "center" }, (ownerState.active && {
        color: theme.palette.primary.main
    })), { "& .QontoStepIcon-completedIcon": {
            color: theme.palette.primary.main,
            zIndex: 1,
            fontSize: 18,
            marginLeft: "4px"
        }, "& .QontoStepIcon-circle": {
            width: 8,
            height: 8,
            marginLeft: "8px",
            borderRadius: "50%",
            backgroundColor: "currentColor"
        } }));
});
function QontoStepIcon(props) {
    var active = props.active, completed = props.completed, className = props.className;
    return (<QontoStepIconRoot ownerState={{ active: active }} className={className}>
      {completed ? <iconoir_react_1.Check className="QontoStepIcon-completedIcon"/> : <div className="QontoStepIcon-circle"/>}
    </QontoStepIconRoot>);
}
