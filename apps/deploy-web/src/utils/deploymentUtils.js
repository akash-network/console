"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDeploymentData = validateDeploymentData;
exports.getGpusFromAttributes = getGpusFromAttributes;
/**
 * Validate values to change in the template
 */
function validateDeploymentData(deploymentData, selectedTemplate) {
    var _a, _b;
    if (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.valuesToChange) {
        var _loop_1 = function (valueToChange) {
            if (valueToChange.field === "accept" || valueToChange.field === "env") {
                var serviceNames = Object.keys(deploymentData.sdl.services);
                for (var _d = 0, serviceNames_1 = serviceNames; _d < serviceNames_1.length; _d++) {
                    var serviceName = serviceNames_1[_d];
                    if (((_a = deploymentData.sdl.services[serviceName].expose) === null || _a === void 0 ? void 0 : _a.some(function (e) { var _a; return (_a = e.accept) === null || _a === void 0 ? void 0 : _a.includes(valueToChange.initialValue); })) ||
                        ((_b = deploymentData.sdl.services[serviceName].env) === null || _b === void 0 ? void 0 : _b.some(function (e) { return e === null || e === void 0 ? void 0 : e.includes(valueToChange.initialValue); }))) {
                        var error = new Error("Template value of \"".concat(valueToChange.initialValue, "\" needs to be changed"));
                        error.name = "TemplateValidation";
                        throw error;
                    }
                }
            }
        };
        for (var _i = 0, _c = selectedTemplate.valuesToChange; _i < _c.length; _i++) {
            var valueToChange = _c[_i];
            _loop_1(valueToChange);
        }
    }
}
function getGpusFromAttributes(attributes) {
    return attributes
        .filter(function (attr) { return attr.key.startsWith("vendor/") && attr.value === "true"; })
        .map(function (attr) {
        var modelKey = attr.key.split("/");
        // vendor/nvidia/model/h100 -> nvidia,h100
        return { vendor: modelKey[1], model: modelKey[3] };
    });
}
