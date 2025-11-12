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
exports.buildAlert = buildAlert;
var akash_v1beta4_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta4");
var faker_1 = require("@faker-js/faker");
function buildAlert(overrides) {
    if ((overrides === null || overrides === void 0 ? void 0 : overrides.type) === "DEPLOYMENT_BALANCE") {
        return buildDeploymentBalanceAlert(overrides);
    }
    if ((overrides === null || overrides === void 0 ? void 0 : overrides.type) === "CHAIN_MESSAGE") {
        return buildChainMessageAlert(overrides);
    }
    return buildChainMessageAlert();
}
function buildChainMessageAlert(overrides) {
    return __assign(__assign({ id: faker_1.faker.string.uuid(), name: faker_1.faker.lorem.words(2), deploymentName: faker_1.faker.lorem.words(2), conditions: {
            operator: faker_1.faker.helpers.arrayElement(["eq", "lt", "gt", "lte", "gte"]),
            field: faker_1.faker.lorem.word(),
            value: faker_1.faker.string.uuid()
        }, summary: faker_1.faker.lorem.sentence(), description: faker_1.faker.lorem.paragraph(), status: faker_1.faker.helpers.arrayElement(["OK", "TRIGGERED"]), enabled: faker_1.faker.datatype.boolean(), notificationChannelId: faker_1.faker.string.uuid(), userId: faker_1.faker.string.uuid(), createdAt: faker_1.faker.date.past(), updatedAt: faker_1.faker.date.recent(), params: {
            dseq: faker_1.faker.number.int({ min: 1000, max: 999999 }).toString(),
            type: faker_1.faker.helpers.arrayElement([akash_v1beta4_1.MsgCreateDeployment.$type, akash_v1beta4_1.MsgCloseDeployment.$type])
        } }, overrides), { type: "CHAIN_MESSAGE" });
}
function buildDeploymentBalanceAlert(overrides) {
    return __assign(__assign({ id: faker_1.faker.string.uuid(), name: faker_1.faker.lorem.words(2), deploymentName: faker_1.faker.lorem.words(2), conditions: {
            operator: faker_1.faker.helpers.arrayElement(["eq", "lt", "gt", "lte", "gte"]),
            field: "balance",
            value: faker_1.faker.number.int({ min: 0, max: 1000 })
        }, summary: faker_1.faker.lorem.sentence(), description: faker_1.faker.lorem.paragraph(), status: faker_1.faker.helpers.arrayElement(["OK", "TRIGGERED"]), enabled: faker_1.faker.datatype.boolean(), notificationChannelId: faker_1.faker.string.uuid(), userId: faker_1.faker.string.uuid(), createdAt: faker_1.faker.date.past(), updatedAt: faker_1.faker.date.recent(), params: {
            dseq: faker_1.faker.number.int({ min: 1000, max: 999999 }).toString(),
            owner: faker_1.faker.string.uuid()
        } }, overrides), { type: "DEPLOYMENT_BALANCE" });
}
