"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBackNav = void 0;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var useBackNav = function (fallback) {
    var router = (0, navigation_1.useRouter)();
    return (0, react_1.useCallback)(function () {
        if (window.history.length > 1) {
            router.back();
        }
        else {
            router.push(fallback);
        }
    }, [router, fallback]);
};
exports.useBackNav = useBackNav;
