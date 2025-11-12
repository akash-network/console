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
exports.buildDeploymentAlert = buildDeploymentAlert;
var faker_1 = require("@faker-js/faker");
function buildDeploymentAlert(overrides) {
    return __assign({ dseq: faker_1.faker.string.numeric(), alerts: {
            deploymentBalance: {
                id: faker_1.faker.string.uuid(),
                status: "NORMAL",
                notificationChannelId: faker_1.faker.string.uuid(),
                threshold: faker_1.faker.number.int({ min: 100, max: 1000 }),
                enabled: true
            },
            deploymentClosed: {
                id: faker_1.faker.string.uuid(),
                status: "NORMAL",
                notificationChannelId: faker_1.faker.string.uuid(),
                enabled: true
            }
        } }, overrides);
}
