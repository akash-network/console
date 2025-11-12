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
exports.CopyTextToClipboardButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var notistack_1 = require("notistack");
var defaultProps = {
    message: "Copied to clipboard!",
    icon: iconoir_react_1.Copy
};
var CopyTextToClipboardButton = function (props) {
    var actualProps = __assign(__assign({}, defaultProps), props);
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var onClick = (0, react_1.useCallback)(function () {
        (0, utils_1.copyTextToClipboard)(actualProps.value);
        enqueueSnackbar(<components_1.Snackbar title="Copied to clipboard!" iconVariant="success"/>, { variant: "success", autoHideDuration: 1500 });
    }, [actualProps.value, enqueueSnackbar]);
    return (<components_1.Button onClick={onClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
      <actualProps.icon className="text-xs text-muted-foreground"/>
    </components_1.Button>);
};
exports.CopyTextToClipboardButton = CopyTextToClipboardButton;
