"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var useFormPersist = function (name, _a) {
    var storage = _a.storage, watch = _a.watch, setValue = _a.setValue, _b = _a.exclude, exclude = _b === void 0 ? [] : _b, onDataRestored = _a.onDataRestored, _c = _a.validate, validate = _c === void 0 ? false : _c, _d = _a.dirty, dirty = _d === void 0 ? false : _d, _e = _a.touch, touch = _e === void 0 ? false : _e, onTimeout = _a.onTimeout, timeout = _a.timeout, defaultValues = _a.defaultValues;
    var watchedValues = watch();
    var getStorage = function () { return storage || window.sessionStorage; };
    var clearStorage = function () { return getStorage().removeItem(name); };
    (0, react_1.useEffect)(function () {
        var str = getStorage().getItem(name);
        var parsed = str ? JSON.parse(str) : defaultValues;
        if (parsed) {
            var _a = parsed._timestamp, _timestamp = _a === void 0 ? null : _a, values_1 = __rest(parsed, ["_timestamp"]);
            var dataRestored_1 = {};
            var currTimestamp = Date.now();
            if (timeout && currTimestamp - _timestamp > timeout) {
                onTimeout && onTimeout();
                clearStorage();
                return;
            }
            Object.keys(values_1).forEach(function (key) {
                var shouldSet = !exclude.includes(key);
                if (shouldSet) {
                    dataRestored_1[key] = values_1[key];
                    setValue(key, values_1[key], {
                        shouldValidate: validate,
                        shouldDirty: dirty,
                        shouldTouch: touch
                    });
                }
            });
            if (onDataRestored) {
                onDataRestored(dataRestored_1);
            }
        }
    }, [storage, name, onDataRestored, setValue, defaultValues]);
    (0, react_1.useEffect)(function () {
        var values = exclude.length
            ? Object.entries(watchedValues)
                .filter(function (_a) {
                var key = _a[0];
                return !exclude.includes(key);
            })
                .reduce(function (obj, _a) {
                var _b;
                var key = _a[0], val = _a[1];
                return Object.assign(obj, (_b = {}, _b[key] = val, _b));
            }, {})
            : Object.assign({}, watchedValues);
        if (Object.entries(values).length) {
            if (timeout !== undefined) {
                values._timestamp = Date.now();
            }
            getStorage().setItem(name, JSON.stringify(values));
        }
    }, [watchedValues, timeout]);
    return {
        clear: function () { return getStorage().removeItem(name); }
    };
};
exports.default = useFormPersist;
