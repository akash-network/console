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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSdlEnv = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var get_1 = require("lodash/get");
var keyValue_1 = require("@src/utils/keyValue/keyValue");
var useSdlEnv = function (_a) {
    var _b;
    var serviceIndex = _a.serviceIndex, schema = _a.schema;
    var _c = (0, react_hook_form_1.useFormContext)(), formState = _c.formState, watch = _c.watch, setValue = _c.setValue, getValues = _c.getValues;
    var services = watch().services;
    var envValues = (0, react_1.useMemo)(function () { var _a; return (serviceIndex >= 0 && ((_a = services[serviceIndex]) === null || _a === void 0 ? void 0 : _a.env)) || []; }, [serviceIndex, (_b = services[serviceIndex]) === null || _b === void 0 ? void 0 : _b.env]);
    var env = (0, react_1.useMemo)(function () { return (0, keyValue_1.kvArrayToObject)(envValues); }, [envValues]);
    var hasErrors = (0, get_1.default)(formState.errors, "services.".concat(serviceIndex, ".env"));
    var errors = (0, react_1.useMemo)(function () {
        var _a;
        if (!hasErrors) {
            return {};
        }
        var _b = schema.safeParse(env), success = _b.success, error = _b.error;
        if (success) {
            return {};
        }
        return (_a = error === null || error === void 0 ? void 0 : error.errors) === null || _a === void 0 ? void 0 : _a.reduce(function (acc, error) {
            acc[error.path.join(".")] = error.message;
            return acc;
        }, {});
    }, [env, hasErrors, schema]);
    return (0, react_1.useMemo)(function () { return ({
        values: env,
        setValue: function (key, value) {
            var _a;
            if (serviceIndex >= 0) {
                var prev = getValues("services.".concat(serviceIndex, ".env"));
                setValue("services.".concat(serviceIndex, ".env"), (0, keyValue_1.objectToKvArray)(__assign(__assign({}, (0, keyValue_1.kvArrayToObject)(prev || [])), (_a = {}, _a[key] = value, _a))));
            }
        },
        errors: errors
    }); }, [env, errors, getValues, serviceIndex, setValue]);
};
exports.useSdlEnv = useSdlEnv;
