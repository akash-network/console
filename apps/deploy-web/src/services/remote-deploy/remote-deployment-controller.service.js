"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvVarUpdater = void 0;
exports.formatUrlWithoutInitialPath = formatUrlWithoutInitialPath;
exports.isCiCdImageInYaml = isCiCdImageInYaml;
exports.extractRepositoryUrl = extractRepositoryUrl;
var nanoid_1 = require("nanoid");
var browser_env_config_1 = require("@src/config/browser-env.config");
var EnvVarUpdater = /** @class */ (function () {
    function EnvVarUpdater(services) {
        this.services = services;
    }
    EnvVarUpdater.prototype.addOrUpdateEnvironmentVariable = function (key, value, isSecret) {
        var _a;
        var environmentVariables = ((_a = this.services[0]) === null || _a === void 0 ? void 0 : _a.env) || [];
        var existingVariable = environmentVariables.find(function (envVar) { return envVar.key === key; });
        if (existingVariable) {
            return environmentVariables.map(function (envVar) {
                if (envVar.key === key) {
                    return __assign(__assign({}, envVar), { value: value, isSecret: isSecret });
                }
                return envVar;
            });
        }
        else {
            return __spreadArray(__spreadArray([], environmentVariables, true), [{ id: (0, nanoid_1.nanoid)(), key: key, value: value, isSecret: isSecret }], false);
        }
    };
    EnvVarUpdater.prototype.deleteEnvironmentVariable = function (key) {
        var _a;
        var environmentVariables = ((_a = this.services[0]) === null || _a === void 0 ? void 0 : _a.env) || [];
        return environmentVariables.filter(function (envVar) { return envVar.key !== key; });
    };
    return EnvVarUpdater;
}());
exports.EnvVarUpdater = EnvVarUpdater;
function formatUrlWithoutInitialPath(url) {
    return url === null || url === void 0 ? void 0 : url.split("/").slice(-2).join("/");
}
function isCiCdImageInYaml(yml) {
    return yml.includes(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_CI_CD_IMAGE_NAME);
}
function extractRepositoryUrl(yml) {
    if (!yml)
        return null;
    var lines = yml.split("\n");
    var envStartIndex = lines.findIndex(function (line) { return line.includes("env:"); });
    var profileStartIndex = lines.findIndex(function (line) { return line.includes("profiles:"); });
    var envVariables = lines.slice(envStartIndex + 1, profileStartIndex);
    var repoUrlLine = envVariables.find(function (line) { return line.includes("REPO_URL"); });
    return repoUrlLine ? repoUrlLine.split("=")[1] : null;
}
