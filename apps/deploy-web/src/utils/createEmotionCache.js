"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createEmotionCache;
var cache_1 = require("@emotion/cache");
// prepend: true moves MUI styles to the top of the <head> so they're loaded first.
// It allows developers to easily override MUI styles with other styling solutions, like CSS modules.
function createEmotionCache() {
    return (0, cache_1.default)({ key: "mui", prepend: true });
}
