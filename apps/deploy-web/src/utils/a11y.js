"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.a11yTabProps = a11yTabProps;
function a11yTabProps(prefix, controlPrefix, index) {
    return {
        id: "".concat(prefix, "-").concat(index),
        "aria-controls": "".concat(controlPrefix, "-").concat(index)
    };
}
