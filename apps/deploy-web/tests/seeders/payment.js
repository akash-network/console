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
exports.createMockItems = exports.createMockRemovedPaymentMethod = exports.createMockCouponResponse = exports.createMockPaymentResponse = exports.createMockSetupIntent = exports.createMockTransaction = exports.createMockDiscount = exports.createMockPaymentMethod = void 0;
var faker_1 = require("@faker-js/faker");
var createMockPaymentMethod = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "pm_".concat(faker_1.faker.string.alphanumeric(24)), type: "card", card: {
            brand: faker_1.faker.helpers.arrayElement(["visa", "mastercard", "amex"]),
            last4: faker_1.faker.string.numeric(4),
            exp_month: faker_1.faker.number.int({ min: 1, max: 12 }),
            exp_year: faker_1.faker.number.int({ min: 2024, max: 2030 }),
            fingerprint: faker_1.faker.string.alphanumeric(16)
        }, billing_details: {
            name: faker_1.faker.person.fullName(),
            email: faker_1.faker.internet.email()
        } }, overrides));
};
exports.createMockPaymentMethod = createMockPaymentMethod;
var createMockDiscount = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "di_".concat(faker_1.faker.string.alphanumeric(24)), coupon: {
            id: faker_1.faker.helpers.arrayElement(["25OFF", "WELCOME10", "SUMMER20"]),
            percent_off: faker_1.faker.helpers.arrayElement([10, 15, 20, 25]),
            duration: faker_1.faker.helpers.arrayElement(["forever", "once", "repeating"]),
            name: faker_1.faker.helpers.arrayElement(["25% Off Forever", "Welcome 10% Off", "Summer 20% Off"])
        }, start: faker_1.faker.date.past().getTime(), end: faker_1.faker.helpers.maybe(function () { return faker_1.faker.date.future().getTime(); }, { probability: 0.5 }) }, overrides));
};
exports.createMockDiscount = createMockDiscount;
var createMockTransaction = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "pi_".concat(faker_1.faker.string.alphanumeric(24)), amount: faker_1.faker.number.int({ min: 1000, max: 10000 }), currency: "usd", status: faker_1.faker.helpers.arrayElement(["succeeded", "pending", "failed"]), payment_method: (0, exports.createMockPaymentMethod)(), created: faker_1.faker.date.past().getTime(), description: faker_1.faker.helpers.arrayElement(["Monthly subscription", "One-time purchase", "Annual plan"]) }, overrides));
};
exports.createMockTransaction = createMockTransaction;
var createMockSetupIntent = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "seti_".concat(faker_1.faker.string.alphanumeric(24)), client_secret: "seti_".concat(faker_1.faker.string.alphanumeric(24), "_secret_").concat(faker_1.faker.string.alphanumeric(9)), status: "requires_payment_method", payment_method_types: ["card"], created: faker_1.faker.date.past().getTime() }, overrides));
};
exports.createMockSetupIntent = createMockSetupIntent;
var createMockPaymentResponse = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "pi_".concat(faker_1.faker.string.alphanumeric(24)), status: "succeeded", amount: faker_1.faker.number.int({ min: 100, max: 1000 }), currency: "usd" }, overrides));
};
exports.createMockPaymentResponse = createMockPaymentResponse;
var createMockCouponResponse = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ coupon: {
            id: faker_1.faker.helpers.arrayElement(["25OFF", "WELCOME10", "SUMMER20"]),
            percent_off: faker_1.faker.helpers.arrayElement([10, 15, 20, 25]),
            valid: true,
            name: faker_1.faker.helpers.arrayElement(["25% Off Forever", "Welcome 10% Off", "Summer 20% Off"])
        }, amountAdded: faker_1.faker.number.float({ min: 5, max: 50, fractionDigits: 2 }) }, overrides));
};
exports.createMockCouponResponse = createMockCouponResponse;
var createMockRemovedPaymentMethod = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: "pm_".concat(faker_1.faker.string.alphanumeric(24)), deleted: true }, overrides));
};
exports.createMockRemovedPaymentMethod = createMockRemovedPaymentMethod;
// Helper to create multiple items
var createMockItems = function (creator, count, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return Array.from({ length: count }, function () { return creator(overrides); });
};
exports.createMockItems = createMockItems;
