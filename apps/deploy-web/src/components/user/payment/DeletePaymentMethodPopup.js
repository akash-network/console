"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletePaymentMethodPopup = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var DeletePaymentMethodPopup = function (_a) {
    var open = _a.open, onClose = _a.onClose, onConfirm = _a.onConfirm, isRemovingPaymentMethod = _a.isRemovingPaymentMethod;
    return (<components_1.Popup open={open} onClose={onClose} title="Remove Payment Method" variant="custom" actions={[
            {
                label: "Cancel",
                variant: "ghost",
                onClick: onClose,
                side: "left"
            },
            {
                label: "Remove",
                onClick: onConfirm,
                variant: "default",
                disabled: isRemovingPaymentMethod,
                side: "right"
            }
        ]}>
      <p>Are you sure you want to remove this payment method?</p>
    </components_1.Popup>);
};
exports.DeletePaymentMethodPopup = DeletePaymentMethodPopup;
