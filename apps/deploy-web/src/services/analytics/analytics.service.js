"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
var amplitude = require("@amplitude/analytics-browser");
var murmurhash_1 = require("murmurhash");
var nextjs_google_analytics_1 = require("nextjs-google-analytics");
var browser_env_config_1 = require("@src/config/browser-env.config");
var GA_EVENTS = {
    successful_tx: "successful_transaction",
    leap_tx_complete: "leap_transaction_complete",
    revoke_all_certificates: "revoke_all_certificate"
};
var AMPLITUDE_USER_PROPERTIES_MAP = {
    id: "user_id",
    anonymous: "is_anonymous",
    emailVerified: "is_email_verified",
    custodialWallet: "custodial_wallet",
    managedWallet: "managed_wallet"
};
var isBrowser = typeof window !== "undefined";
var AnalyticsService = /** @class */ (function () {
    function AnalyticsService(options, amplitude, hash, ga, getGtag, storage) {
        if (getGtag === void 0) { getGtag = function () { return undefined; }; }
        this.options = options;
        this.amplitude = amplitude;
        this.hash = hash;
        this.ga = ga;
        this.getGtag = getGtag;
        this.storage = storage;
        this.STORAGE_KEY = "analytics_values_cache";
        this.valuesCache = this.loadSwitchValuesFromStorage();
        if (this.options.amplitude.enabled === false) {
            this.isAmplitudeEnabled = false;
        }
    }
    Object.defineProperty(AnalyticsService.prototype, "gtag", {
        get: function () {
            return this.getGtag();
        },
        enumerable: false,
        configurable: true
    });
    AnalyticsService.prototype.loadSwitchValuesFromStorage = function () {
        var _a;
        if (typeof window !== "undefined") {
            var stored = (_a = this.storage) === null || _a === void 0 ? void 0 : _a.getItem(this.STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                return new Map(Object.entries(parsed));
            }
        }
        return new Map();
    };
    AnalyticsService.prototype.identify = function (user) {
        if (!isBrowser || !Object.keys(user).length) {
            return;
        }
        if (this.options.ga.enabled && this.gtag && user.id) {
            this.gtag("config", this.options.ga.measurementId, { user_id: user.id });
        }
        this.ensureAmplitudeFor(user);
        if (!this.isAmplitudeEnabled) {
            return;
        }
        var event = new this.amplitude.Identify();
        for (var key in user) {
            if (key !== "id") {
                event.set(AMPLITUDE_USER_PROPERTIES_MAP[key] || key, String(user[key]));
            }
        }
        this.amplitude.identify(event);
        if (user.id) {
            this.amplitude.setUserId(user.id);
        }
    };
    AnalyticsService.prototype.ensureAmplitudeFor = function (user) {
        if (typeof this.isAmplitudeEnabled === "undefined" && user.id) {
            this.isAmplitudeEnabled = this.shouldSampleUser(user.id);
            if (this.isAmplitudeEnabled) {
                this.amplitude.init(this.options.amplitude.apiKey);
            }
        }
    };
    AnalyticsService.prototype.trackSwitch = function (eventName, value, target) {
        if (!isBrowser) {
            return;
        }
        if (this.valuesCache.get(eventName) === value) {
            return;
        }
        this.saveSwitchValue(eventName, value);
        return this.track(eventName, { value: value }, target);
    };
    AnalyticsService.prototype.saveSwitchValue = function (eventName, value) {
        var _a;
        this.valuesCache.set(eventName, value);
        var obj = Object.fromEntries(this.valuesCache);
        (_a = this.storage) === null || _a === void 0 ? void 0 : _a.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    };
    AnalyticsService.prototype.track = function (eventName, eventPropertiesOrTarget, target) {
        var _a;
        if (!isBrowser) {
            return;
        }
        var analyticsTarget = typeof eventPropertiesOrTarget === "string" ? eventPropertiesOrTarget : target;
        var eventProperties = typeof eventPropertiesOrTarget === "object" ? eventPropertiesOrTarget : {};
        if (this.isAmplitudeEnabled && (!analyticsTarget || analyticsTarget === "Amplitude")) {
            this.amplitude.track(eventName, eventProperties);
        }
        if (this.options.ga.enabled && (!analyticsTarget || analyticsTarget === "GA")) {
            (_a = this.ga) === null || _a === void 0 ? void 0 : _a.event.apply(_a, this.transformGaEvent(eventName, eventProperties));
        }
    };
    AnalyticsService.prototype.transformGaEvent = function (eventName, eventProperties) {
        if (eventName === "navigate_tab") {
            return ["".concat(eventName, "_").concat(eventProperties.tab), eventProperties];
        }
        return [GA_EVENTS[eventName] || eventName, eventProperties];
    };
    AnalyticsService.prototype.shouldSampleUser = function (userId) {
        var hashValue = this.hash(userId);
        var percentage = Math.abs(hashValue) % 100;
        return percentage < this.options.amplitude.samplingRate * 100;
    };
    return AnalyticsService;
}());
exports.AnalyticsService = AnalyticsService;
var localStorage = isBrowser ? window.localStorage : undefined;
/**
 * @deprecated use useServices() instead
 */
exports.analyticsService = new AnalyticsService({
    amplitude: {
        enabled: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_AMPLITUDE_ENABLED,
        apiKey: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_AMPLITUDE_API_KEY,
        samplingRate: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_AMPLITUDE_SAMPLING
    },
    ga: {
        measurementId: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        enabled: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GA_ENABLED
    }
}, amplitude, murmurhash_1.default.v3, { event: nextjs_google_analytics_1.event }, function () { return (isBrowser ? window.gtag : undefined); }, localStorage);
