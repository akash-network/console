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
exports.buildAnonymousUser = exports.buildUser = void 0;
var faker_1 = require("@faker-js/faker");
var plans_1 = require("@src/utils/plans");
var buildUser = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: faker_1.faker.string.uuid(), userId: faker_1.faker.string.uuid(), email: faker_1.faker.internet.email(), emailVerified: faker_1.faker.datatype.boolean(), name: faker_1.faker.person.fullName(), picture: faker_1.faker.image.avatar(), username: faker_1.faker.internet.username(), subscribedToNewsletter: faker_1.faker.datatype.boolean(), bio: faker_1.faker.lorem.sentence(), youtubeUsername: faker_1.faker.internet.username(), twitterUsername: faker_1.faker.internet.username(), githubUsername: faker_1.faker.internet.username(), planCode: "COMMUNITY", plan: plans_1.plans.find(function (plan) { return plan.code === "COMMUNITY"; }) }, overrides);
};
exports.buildUser = buildUser;
var buildAnonymousUser = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: faker_1.faker.string.uuid(), userId: faker_1.faker.string.uuid(), email: faker_1.faker.internet.email(), emailVerified: faker_1.faker.datatype.boolean(), subscribedToNewsletter: faker_1.faker.datatype.boolean(), bio: faker_1.faker.lorem.sentence(), youtubeUsername: faker_1.faker.internet.username(), twitterUsername: faker_1.faker.internet.username(), githubUsername: faker_1.faker.internet.username() }, overrides);
};
exports.buildAnonymousUser = buildAnonymousUser;
