"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.transformCustomSdlFields = exports.TransformError = void 0;
var cloneDeep_1 = require("lodash/cloneDeep");
var flow_1 = require("lodash/flow");
var isMatch_1 = require("lodash/isMatch");
var data_1 = require("@src/utils/sdl/data");
var TransformError = /** @class */ (function (_super) {
    __extends(TransformError, _super);
    function TransformError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TransformError;
}(Error));
exports.TransformError = TransformError;
var transformCustomSdlFields = function (services, options) {
    var pipeline = [addSshPubKey, ensureServiceCount];
    if (options === null || options === void 0 ? void 0 : options.withSSH) {
        pipeline.push(ensureSSHExpose);
        pipeline.push(mapImage);
    }
    var transform = (0, flow_1.default)(pipeline);
    return services.map(function (service) { return transform(service); });
};
exports.transformCustomSdlFields = transformCustomSdlFields;
function addSshPubKey(input) {
    var sshPubKey = input.sshPubKey;
    if (!sshPubKey) {
        return input;
    }
    var output = (0, cloneDeep_1.default)(input);
    output.env = output.env || [];
    var sshPubKeyEnv = output.env.find(function (e) { return e.key === "SSH_PUBKEY"; });
    if (sshPubKeyEnv) {
        sshPubKeyEnv.value = sshPubKey;
    }
    else {
        output.env.push({
            id: "SSH_PUBKEY",
            key: "SSH_PUBKEY",
            value: sshPubKey,
            isSecret: false
        });
    }
    return output;
}
function ensureSSHExpose(service) {
    if (service.expose.some(function (exp) { return (0, isMatch_1.default)(exp, data_1.SSH_EXPOSE); })) {
        return service;
    }
    if (service.expose.some(function (exp) { return exp.port === 22; })) {
        throw new TransformError("Expose outer port 22 is reserved");
    }
    if (service.expose.some(function (exp) { return exp.as === 22; })) {
        throw new TransformError("Expose inner port 22 is reserved");
    }
    var output = (0, cloneDeep_1.default)(service);
    output.expose.push(__assign({ id: "ssh" }, data_1.SSH_EXPOSE));
    return output;
}
function ensureServiceCount(input) {
    if (input.count === 1) {
        return input;
    }
    var output = (0, cloneDeep_1.default)(input);
    output.count = 1;
    return output;
}
function mapImage(input) {
    var image = data_1.SSH_VM_IMAGES[input.image];
    if (!image) {
        return input;
    }
    var output = (0, cloneDeep_1.default)(input);
    output.image = image;
    return output;
}
