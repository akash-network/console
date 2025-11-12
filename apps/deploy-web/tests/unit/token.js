"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readToken = exports.writeToken = void 0;
var jotai_1 = require("jotai");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var react_1 = require("@testing-library/react");
var writeToken = function (_a) {
    var accessToken = _a.accessToken, refreshToken = _a.refreshToken, type = _a.type;
    (0, react_1.renderHook)(function () {
        var _a = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), token = _a[0], setToken = _a[1];
        if (token.accessToken !== accessToken) {
            setToken({ accessToken: accessToken, refreshToken: refreshToken, type: type });
        }
    });
};
exports.writeToken = writeToken;
var readToken = function () {
    var result = (0, react_1.renderHook)(function () {
        var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
        return token.accessToken;
    }).result;
    return result.current;
};
exports.readToken = readToken;
