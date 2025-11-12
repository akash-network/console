"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useThrottledEffect = useThrottledEffect;
var react_1 = require("react");
function useThrottledEffect(effect, deps, delay) {
    if (delay === void 0) { delay = 100; }
    var timeout = (0, react_1.useRef)(null);
    var cleanup = (0, react_1.useRef)();
    (0, react_1.useEffect)(function () {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
        timeout.current = setTimeout(function () {
            if (typeof cleanup.current === "function") {
                cleanup.current();
                cleanup.current = undefined;
            }
            cleanup.current = effect();
            timeout.current = null;
        }, delay);
        return function () {
            if (timeout.current) {
                clearTimeout(timeout.current);
                timeout.current = null;
            }
            if (typeof cleanup.current === "function") {
                cleanup.current();
                cleanup.current = undefined;
            }
        };
    }, deps);
}
