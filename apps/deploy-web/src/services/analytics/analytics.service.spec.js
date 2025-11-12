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
var faker_1 = require("@faker-js/faker");
var analytics_service_1 = require("./analytics.service");
describe(analytics_service_1.AnalyticsService.name, function () {
    var mockAmplitudeApiKey = faker_1.faker.string.uuid();
    var mockGaMeasurementId = faker_1.faker.string.uuid();
    describe("initialization", function () {
        it("should not initialize Amplitude when disabled", function () {
            var init = jest.fn();
            var service = setup({
                amplitude: { init: init },
                options: {
                    amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: false, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            expect(init).not.toHaveBeenCalled();
        });
        it("should initialize Amplitude only for sampled users when enabled", function () {
            var init = jest.fn();
            var service = setup({
                amplitude: { init: init },
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: false, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            expect(init).toHaveBeenCalled();
        });
    });
    describe("user sampling", function () {
        it("should sample amplitude users based on hash value", function () {
            var init = jest.fn();
            var hashFn = jest.fn().mockImplementation(function () { return 120; });
            var service = setup({
                amplitude: { init: init },
                hashFn: hashFn,
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: false, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            expect(hashFn).toHaveBeenCalled();
            expect(init).toHaveBeenCalled();
        });
        it("should not sample amplitude users based on hash value", function () {
            var init = jest.fn();
            var hashFn = jest.fn().mockImplementation(function () { return 125; });
            var service = setup({
                amplitude: { init: init },
                hashFn: hashFn,
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: false, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            expect(hashFn).toHaveBeenCalled();
            expect(init).not.toHaveBeenCalled();
        });
    });
    describe("switch value caching", function () {
        it("should only track when switch value changes", function () {
            var track = jest.fn();
            var service = setup({
                amplitude: {
                    track: track
                },
                storage: {
                    getItem: jest.fn().mockReturnValue(JSON.stringify({
                        connect_wallet: "custodial"
                    })),
                    setItem: jest.fn()
                },
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: false, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            service.trackSwitch("connect_wallet", "managed", "Amplitude");
            service.trackSwitch("connect_wallet", "managed", "Amplitude");
            expect(track).toHaveBeenCalledWith("connect_wallet", {
                value: "managed"
            });
            expect(track).toHaveBeenCalledTimes(1);
        });
    });
    describe("identify", function () {
        it("should identify user in both GA and Amplitude", function () {
            var identify = jest.fn();
            var setUserId = jest.fn();
            var service = setup({
                amplitude: { identify: identify, setUserId: setUserId },
                ga: { event: jest.fn() },
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            service.identify({ id: faker_1.faker.string.uuid() });
            expect(identify).toHaveBeenCalled();
            expect(setUserId).toHaveBeenCalled();
        });
        it("should only identify in enabled services", function () {
            var identify = jest.fn();
            var setUserId = jest.fn();
            var gtag = jest.fn();
            var service = setup({
                amplitude: { identify: identify, setUserId: setUserId },
                gtag: gtag,
                options: {
                    amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var user = { id: faker_1.faker.string.uuid() };
            service.identify(user);
            expect(gtag).toHaveBeenCalledWith("config", mockGaMeasurementId, { user_id: user.id });
            expect(identify).not.toHaveBeenCalled();
            expect(setUserId).not.toHaveBeenCalled();
        });
    });
    describe("track", function () {
        it("should track events in both GA and Amplitude when no target specified", function () {
            var track = jest.fn();
            var event = jest.fn();
            var service = setup({
                amplitude: { track: track },
                ga: { event: event },
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var properties = {
                category: "wallet",
                someProperty: faker_1.faker.word.sample()
            };
            service.identify({ id: faker_1.faker.string.uuid() }); // Initialize sampling
            service.track("connect_wallet", properties);
            expect(track).toHaveBeenCalledWith("connect_wallet", properties);
            expect(event).toHaveBeenCalledWith("connect_wallet", properties);
        });
        it("should track events only in specified target", function () {
            var track = jest.fn();
            var event = jest.fn();
            var service = setup({
                amplitude: { track: track },
                ga: { event: event },
                options: {
                    amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var properties = { category: "wallet" };
            service.identify({ id: faker_1.faker.string.uuid() }); // Initialize sampling
            service.track("connect_wallet", properties, "Amplitude");
            expect(track).toHaveBeenCalledWith("connect_wallet", properties);
            expect(event).not.toHaveBeenCalled();
        });
        it("should transform GA event names correctly", function () {
            var event = jest.fn();
            var service = setup({
                ga: { event: event },
                options: {
                    amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var properties = { category: "transactions" };
            service.track("successful_tx", properties);
            expect(event).toHaveBeenCalledWith("successful_transaction", properties);
        });
        it("should handle navigate_tab events specially for GA", function () {
            var event = jest.fn();
            var service = setup({
                ga: { event: event },
                options: {
                    amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var properties = {
                category: "user",
                tab: "settings"
            };
            service.track("navigate_tab", properties);
            expect(event).toHaveBeenCalledWith("navigate_tab_settings", properties);
        });
        it("should only track in enabled services", function () {
            var track = jest.fn();
            var event = jest.fn();
            var service = setup({
                amplitude: { track: track },
                ga: { event: event },
                options: {
                    amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
                    ga: { enabled: true, measurementId: mockGaMeasurementId }
                }
            });
            var properties = { category: "wallet" };
            service.track("connect_wallet", properties);
            expect(track).not.toHaveBeenCalled();
            expect(event).toHaveBeenCalled();
        });
    });
    function setup(params) {
        var _a, _b, _c, _d, _e;
        var amplitude = __assign({ init: jest.fn(), Identify: jest.fn().mockImplementation(function () { return ({
                set: jest.fn()
            }); }), identify: jest.fn(), track: jest.fn(), setUserId: jest.fn() }, ((_a = params.amplitude) !== null && _a !== void 0 ? _a : {}));
        var ga = __assign({ event: jest.fn() }, ((_b = params.ga) !== null && _b !== void 0 ? _b : {}));
        var hash = (_c = params.hashFn) !== null && _c !== void 0 ? _c : jest.fn().mockImplementation(function () { return 0; });
        var storage = (_d = params.storage) !== null && _d !== void 0 ? _d : {
            getItem: jest.fn(),
            setItem: jest.fn()
        };
        return new analytics_service_1.AnalyticsService((_e = params.options) !== null && _e !== void 0 ? _e : {
            amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 1 },
            ga: { enabled: false, measurementId: mockGaMeasurementId }
        }, amplitude, hash, ga, function () { var _a; return (_a = params.gtag) !== null && _a !== void 0 ? _a : jest.fn(); }, storage);
    }
});
