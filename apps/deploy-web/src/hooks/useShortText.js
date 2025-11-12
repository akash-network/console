"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplitText = exports.SPLIT_TEXT_GLUE = exports.getShortText = void 0;
var getShortText = function (text, length) {
    if (text === void 0) { text = ""; }
    return text.length < length ? text : "".concat(text.substring(0, length - 3), "...");
};
exports.getShortText = getShortText;
exports.SPLIT_TEXT_GLUE = "...";
var getSplitText = function (text, start, end) {
    if (start === void 0) { start = 5; }
    if (end === void 0) { end = 5; }
    var splittedText = [text === null || text === void 0 ? void 0 : text.slice(0, start), exports.SPLIT_TEXT_GLUE, text === null || text === void 0 ? void 0 : text.slice((text === null || text === void 0 ? void 0 : text.length) - end)].join("");
    return splittedText;
};
exports.getSplitText = getSplitText;
