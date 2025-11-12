"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeCsvField = exports.getShortText = void 0;
exports.stringToBoolean = stringToBoolean;
exports.capitalizeFirstLetter = capitalizeFirstLetter;
exports.isUrl = isUrl;
exports.selectText = selectText;
function stringToBoolean(str) {
    if (str === void 0) { str = ""; }
    switch (str.toLowerCase()) {
        case "false":
        case "no":
        case "0":
        case "":
            return false;
        default:
            return true;
    }
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function isUrl(val) {
    try {
        var url = new URL(val);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch (_) {
        return false;
    }
}
function selectText(node) {
    if (document.body.createTextRange) {
        var range = document.body.createTextRange();
        range.moveToElementText(node);
        range.select();
    }
    else if (window.getSelection) {
        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(node);
        selection === null || selection === void 0 ? void 0 : selection.removeAllRanges();
        selection === null || selection === void 0 ? void 0 : selection.addRange(range);
    }
    else {
        console.warn("Could not select text in node: Unsupported browser.");
    }
}
var getShortText = function (text, length) {
    if (text === void 0) { text = ""; }
    return text.length < length ? text : "".concat(text.substring(0, length - 3), "...");
};
exports.getShortText = getShortText;
var sanitizeCsvField = function (value) {
    var stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return "\"".concat(stringValue.replace(/"/g, '""'), "\"");
    }
    return stringValue;
};
exports.sanitizeCsvField = sanitizeCsvField;
