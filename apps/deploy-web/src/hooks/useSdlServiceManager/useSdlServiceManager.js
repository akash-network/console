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
exports.useSdlServiceManager = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var cloneDeep_1 = require("lodash/cloneDeep");
var nanoid_1 = require("nanoid");
var LogCollectorControl_1 = require("@src/components/sdl/LogCollectorControl/LogCollectorControl");
var data_1 = require("@src/utils/sdl/data");
var useSdlServiceManager = function (_a) {
    var control = _a.control;
    var watchedServices = (0, react_hook_form_1.useWatch)({ control: control, name: "services", defaultValue: [] });
    var services = (0, react_1.useMemo)(function () { return (Array.isArray(watchedServices) ? watchedServices : []); }, [watchedServices]);
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services",
        keyName: "id"
    }), removeService = _b.remove, appendService = _b.append;
    var calcNextServiceTitle = (0, react_1.useCallback)(function () {
        var _a, _b;
        var visibleServices = services.filter(function (service) { return !(0, LogCollectorControl_1.isLogCollectorService)(service); });
        var lastService = visibleServices[visibleServices.length - 1];
        var lastServiceIndex = (_b = (_a = lastService === null || lastService === void 0 ? void 0 : lastService.title) === null || _a === void 0 ? void 0 : _a.match(/service-(\d+)/)) === null || _b === void 0 ? void 0 : _b[1];
        var nextIndex = lastServiceIndex ? parseInt(lastServiceIndex) + 1 : visibleServices.length + 1;
        var hasDuplicate = false;
        do {
            hasDuplicate = visibleServices.some(function (service) { return service.title === "service-".concat(nextIndex); });
            if (hasDuplicate) {
                nextIndex++;
            }
        } while (hasDuplicate);
        return "service-".concat(nextIndex);
    }, [services]);
    var add = (0, react_1.useCallback)(function () {
        appendService(__assign(__assign({}, (0, cloneDeep_1.default)(data_1.defaultService)), { id: (0, nanoid_1.nanoid)(), title: calcNextServiceTitle() }));
    }, [appendService, calcNextServiceTitle]);
    var remove = (0, react_1.useCallback)(function (index) {
        var ownLogCollectorServiceIndex = (0, LogCollectorControl_1.findOwnLogCollectorServiceIndex)(services[index], services);
        var indexes = (ownLogCollectorServiceIndex === -1 ? [index] : [index, ownLogCollectorServiceIndex]).sort(function (a, b) { return b - a; });
        removeService(indexes);
    }, [services, removeService]);
    return (0, react_1.useMemo)(function () { return ({
        add: add,
        remove: remove
    }); }, [add, remove]);
};
exports.useSdlServiceManager = useSdlServiceManager;
