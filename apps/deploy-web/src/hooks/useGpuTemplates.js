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
exports.useGpuTemplates = void 0;
var react_1 = require("react");
var js_yaml_1 = require("js-yaml");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var useGpuTemplates = function () {
    var _a = (0, useTemplateQuery_1.useTemplates)(), isLoadingTemplates = _a.isLoading, categories = _a.categories;
    var gpuTemplates = (0, react_1.useMemo)(function () {
        var _a;
        var templates = ((_a = categories === null || categories === void 0 ? void 0 : categories.find(function (x) { return x.title === "AI - GPU"; })) === null || _a === void 0 ? void 0 : _a.templates) || [];
        return templates
            .map(function (x) {
            var templateSdl = js_yaml_1.default.load(x.deploy || "");
            return __assign(__assign({}, x), { image: templateSdl.services[Object.keys(templateSdl.services)[0]].image });
        })
            .filter(function (x) { return x.id; });
    }, [categories]);
    return { isLoadingTemplates: isLoadingTemplates, gpuTemplates: gpuTemplates };
};
exports.useGpuTemplates = useGpuTemplates;
