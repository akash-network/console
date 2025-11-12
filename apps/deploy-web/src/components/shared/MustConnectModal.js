"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MustConnectModal = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var MustConnect_1 = require("./MustConnect");
var MustConnectModal = function (_a) {
    var onClose = _a.onClose, message = _a.message;
    return (<components_1.Popup fullWidth open variant="custom" title="Create an account!" actions={[
            {
                label: "Cancel",
                color: "primary",
                variant: "text",
                side: "right",
                onClick: onClose
            }
        ]} onClose={onClose} maxWidth="xs" enableCloseOnBackdropClick>
      <MustConnect_1.MustConnect message={message}/>
    </components_1.Popup>);
};
exports.MustConnectModal = MustConnectModal;
