"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearLoadingSkeleton = LinearLoadingSkeleton;
var LinearProgress_1 = require("@mui/material/LinearProgress");
function LinearLoadingSkeleton(_a) {
    var isLoading = _a.isLoading;
    return <>{isLoading ? <LinearProgress_1.default color="primary"/> : <div className="h-[4px] w-full min-w-0"/>}</>;
}
