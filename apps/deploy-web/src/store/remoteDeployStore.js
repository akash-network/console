"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokens = void 0;
var utils_1 = require("jotai/utils");
exports.tokens = (0, utils_1.atomWithStorage)("remote-deploy-tokens", {
    accessToken: null,
    refreshToken: null,
    type: "github",
    alreadyLoggedIn: []
});
