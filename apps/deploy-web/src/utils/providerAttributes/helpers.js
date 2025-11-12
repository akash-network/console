"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnknownAttributes = exports.mapFormValuesToAttributes = void 0;
var nanoid_1 = require("nanoid");
/**
 * Maps the form values to the attributes that are broadcasted to the network
 * @param data
 * @param providerAttributesSchema
 * @returns
 */
var mapFormValuesToAttributes = function (data, providerAttributesSchema) {
    var attributes = [];
    Object.keys(data).forEach(function (key) {
        var _a;
        var value = data[key];
        var attribute = providerAttributesSchema[key];
        if (attribute && value) {
            switch (attribute.type) {
                case "string":
                case "number":
                case "boolean":
                    attributes.push({ key: key, value: "".concat(value) });
                    break;
                case "option":
                    // eslint-disable-next-line no-case-declarations
                    var detailValue_1 = value;
                    // eslint-disable-next-line no-case-declarations
                    var attributeValue = (_a = attribute.values) === null || _a === void 0 ? void 0 : _a.find(function (v) { return v.key === detailValue_1.key; });
                    attributes.push({ key: attribute.key, value: "".concat(attributeValue === null || attributeValue === void 0 ? void 0 : attributeValue.key) });
                    break;
                case "multiple-option":
                    // eslint-disable-next-line no-case-declarations
                    var values = value;
                    values.forEach(function (_val) {
                        var _a;
                        var attributeValue = (_a = attribute.values) === null || _a === void 0 ? void 0 : _a.find(function (v) { return v.key === _val.key; });
                        if (attributeValue === null || attributeValue === void 0 ? void 0 : attributeValue.key) {
                            attributes.push({ key: attributeValue.key, value: "".concat(attributeValue === null || attributeValue === void 0 ? void 0 : attributeValue.value) });
                        }
                    });
                    break;
                default:
                    break;
            }
        }
        if (key === "unknown-attributes") {
            var unknownAttributes = value;
            unknownAttributes.forEach(function (x) { return attributes.push({ key: x.key, value: x.value }); });
        }
    });
    return attributes;
};
exports.mapFormValuesToAttributes = mapFormValuesToAttributes;
/**
 * Get the list of attributes that are unknown to the schema
 * @param attributes
 * @param providerAttributesSchema
 * @returns
 */
var getUnknownAttributes = function (attributes, providerAttributesSchema) {
    var possibleAttributes = Object.values(providerAttributesSchema)
        .map(function (x) {
        var _a;
        switch (x.type) {
            case "string":
            case "number":
            case "boolean":
            case "option":
                return x.key;
            case "multiple-option":
                return (_a = x.values) === null || _a === void 0 ? void 0 : _a.map(function (v) { return v.key; });
            default:
                return null;
        }
    })
        .filter(function (x) { return x; })
        .flat();
    var res = attributes.filter(function (x) { return !possibleAttributes.includes(x.key); }).map(function (x) { return ({ id: (0, nanoid_1.nanoid)(), key: x.key, value: x.value }); });
    return res;
};
exports.getUnknownAttributes = getUnknownAttributes;
