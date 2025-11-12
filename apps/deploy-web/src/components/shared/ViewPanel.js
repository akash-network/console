"use strict";
"use client";
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
exports.ViewPanel = void 0;
var react_1 = require("react");
var useWindowSize_1 = require("@src/hooks/useWindowSize");
var ViewPanel = function (_a) {
    var children = _a.children, bottomElementId = _a.bottomElementId, isSameAsParent = _a.isSameAsParent, ratio = _a.ratio, className = _a.className, offset = _a.offset, stickToBottom = _a.stickToBottom, _b = _a.style, style = _b === void 0 ? {} : _b;
    var windowSize = (0, useWindowSize_1.useWindowSize)();
    var _c = (0, react_1.useState)(null), height = _c[0], setHeight = _c[1];
    var ref = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e;
        if (windowSize.height) {
            try {
                var boundingRect = (_a = ref.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
                var height_1;
                if (bottomElementId) {
                    var bottomElementRect = (_b = document.getElementById(bottomElementId)) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect();
                    height_1 = Math.abs(boundingRect.top - bottomElementRect.top);
                }
                else if (isSameAsParent) {
                    var computedStyle = getComputedStyle((_c = ref.current) === null || _c === void 0 ? void 0 : _c.parentElement);
                    var parentRect = (_e = (_d = ref.current) === null || _d === void 0 ? void 0 : _d.parentElement) === null || _e === void 0 ? void 0 : _e.getBoundingClientRect();
                    height_1 = parentRect.height - parseFloat(computedStyle.paddingBottom) - Math.abs(boundingRect.top - parentRect.top);
                }
                else if (stickToBottom) {
                    height_1 = Math.abs(boundingRect.top - window.innerHeight);
                }
                else if (ratio) {
                    height_1 = Math.round(boundingRect.width * ratio);
                }
                else {
                    height_1 = "auto";
                }
                if (offset && typeof height_1 === "number") {
                    height_1 -= offset;
                }
                setHeight(height_1);
            }
            catch (error) {
                setHeight("auto");
            }
        }
    }, [windowSize, bottomElementId, isSameAsParent, offset]);
    return (<div ref={ref} style={__assign({ height: height }, style)} className={className}>
      {height ? children : null}
    </div>);
};
exports.ViewPanel = ViewPanel;
exports.default = exports.ViewPanel;
