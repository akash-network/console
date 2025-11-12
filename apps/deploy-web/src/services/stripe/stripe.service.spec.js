"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var stripe_service_1 = require("./stripe.service");
describe("StripeService", function () {
    describe("getStripe", function () {
        it("should load Stripe instance when publishable key is configured", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, stripeService, mockLoadStripe, mockStripeInstance, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({
                            publishableKey: "pk_test_mock_key"
                        }), stripeService = _a.stripeService, mockLoadStripe = _a.mockLoadStripe, mockStripeInstance = _a.mockStripeInstance;
                        mockLoadStripe.mockResolvedValue(mockStripeInstance);
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 1:
                        result = _b.sent();
                        expect(mockLoadStripe).toHaveBeenCalledWith("pk_test_mock_key");
                        expect(result).toBe(mockStripeInstance);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should return cached instance on subsequent calls", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, stripeService, mockLoadStripe, mockStripeInstance, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({
                            publishableKey: "pk_test_mock_key"
                        }), stripeService = _a.stripeService, mockLoadStripe = _a.mockLoadStripe, mockStripeInstance = _a.mockStripeInstance;
                        mockLoadStripe.mockResolvedValue(mockStripeInstance);
                        // First call
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 1:
                        // First call
                        _b.sent();
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 2:
                        result = _b.sent();
                        expect(mockLoadStripe).toHaveBeenCalledTimes(1);
                        expect(result).toBe(mockStripeInstance);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should handle loadStripe errors gracefully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, stripeService, mockLoadStripe, consoleErrorSpy, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({
                            publishableKey: "pk_test_mock_key"
                        }), stripeService = _a.stripeService, mockLoadStripe = _a.mockLoadStripe;
                        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
                        mockLoadStripe.mockRejectedValue(new Error("Stripe load failed"));
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 1:
                        result = _b.sent();
                        expect(result).toBeNull();
                        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load Stripe:", expect.any(Error));
                        consoleErrorSpy.mockRestore();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("clearStripeInstance", function () {
        it("should clear the cached Stripe instance", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, stripeService, mockLoadStripe, mockStripeInstance;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({
                            publishableKey: "pk_test_mock_key"
                        }), stripeService = _a.stripeService, mockLoadStripe = _a.mockLoadStripe, mockStripeInstance = _a.mockStripeInstance;
                        mockLoadStripe.mockResolvedValue(mockStripeInstance);
                        // Load instance
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 1:
                        // Load instance
                        _b.sent();
                        expect(mockLoadStripe).toHaveBeenCalledTimes(1);
                        // Clear instance
                        stripeService.clearStripeInstance();
                        // Load again
                        return [4 /*yield*/, stripeService.getStripe()];
                    case 2:
                        // Load again
                        _b.sent();
                        expect(mockLoadStripe).toHaveBeenCalledTimes(2);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(input) {
        var mockLoadStripe = jest.fn();
        var mockStripeInstance = (0, jest_mock_extended_1.mock)();
        var mockBrowserEnvConfig = (0, jest_mock_extended_1.mock)();
        mockBrowserEnvConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = input.publishableKey;
        var stripeService = new stripe_service_1.StripeService({
            loadStripe: mockLoadStripe,
            browserEnvConfig: mockBrowserEnvConfig
        });
        return {
            stripeService: stripeService,
            mockLoadStripe: mockLoadStripe,
            mockStripeInstance: mockStripeInstance,
            mockBrowserEnvConfig: mockBrowserEnvConfig
        };
    }
});
