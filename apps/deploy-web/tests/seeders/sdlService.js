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
exports.buildSDLService = void 0;
var faker_1 = require("@faker-js/faker");
var buildSDLService = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: faker_1.faker.string.uuid(), title: faker_1.faker.lorem.word(), image: faker_1.faker.helpers.arrayElement(["nginx:latest", "node:18-alpine", "postgres:15", "redis:7-alpine", "python:3.11-slim"]), placement: {
            name: faker_1.faker.lorem.word(),
            pricing: {
                amount: faker_1.faker.number.int({ min: 100, max: 10000 }),
                denom: faker_1.faker.helpers.arrayElement(["uakt", "uakt"])
            },
            signedBy: {
                anyOf: [],
                allOf: []
            },
            attributes: []
        }, profile: {
            cpu: faker_1.faker.number.float({ min: 0.1, max: 8, fractionDigits: 1 }),
            ram: faker_1.faker.number.int({ min: 256, max: 8192 }),
            ramUnit: faker_1.faker.helpers.arrayElement(["Mi", "Gi"]),
            storage: [
                {
                    size: faker_1.faker.number.int({ min: 1, max: 100 }),
                    unit: faker_1.faker.helpers.arrayElement(["Mi", "Gi"]),
                    isPersistent: faker_1.faker.datatype.boolean()
                }
            ],
            hasGpu: faker_1.faker.datatype.boolean(),
            gpu: faker_1.faker.number.int({ min: 0, max: 8 })
        }, expose: [], count: faker_1.faker.number.int({ min: 1, max: 5 }) }, overrides));
};
exports.buildSDLService = buildSDLService;
