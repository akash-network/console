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
exports.UrlService = exports.domainName = void 0;
exports.appendSearchParams = appendSearchParams;
exports.removeEmptyFilters = removeEmptyFilters;
exports.handleDocClick = handleDocClick;
var networkStore_1 = require("@src/store/networkStore");
exports.domainName = "https://console.akash.network";
var UrlService = /** @class */ (function () {
    function UrlService() {
    }
    UrlService.home = function () { return "/"; };
    UrlService.getStarted = function () { return "/get-started"; };
    UrlService.getStartedWallet = function (section) { return "/get-started/wallet".concat(appendSearchParams({ section: section })); };
    UrlService.sdlBuilder = function (id) { return "/sdl-builder".concat(appendSearchParams({ id: id })); };
    UrlService.rentGpus = function () { return "/rent-gpu"; };
    UrlService.plainLinux = function () { return "/deploy-linux"; };
    UrlService.priceCompare = function () { return "/price-compare"; };
    UrlService.analytics = function () { return "/analytics"; };
    UrlService.graph = function (snapshot) { return "/graph/".concat(snapshot); };
    UrlService.providerGraph = function (snapshot) { return "/provider-graph/".concat(snapshot); };
    UrlService.priceCompareCustom = function (cpu, memory, storage, memoryUnit, storageUnit) {
        return "/price-compare".concat(appendSearchParams({ cpu: cpu, memory: memory, storage: storage, memoryUnit: memoryUnit, storageUnit: storageUnit }));
    };
    UrlService.contact = function () { return "/contact"; };
    UrlService.faq = function (q) { return "/faq".concat(q ? "#" + q : ""); };
    UrlService.privacyPolicy = function () { return "/privacy-policy"; };
    UrlService.termsOfService = function () { return "/terms-of-service"; };
    // User
    UrlService.userSettings = function () { return "/user/settings"; };
    UrlService.userApiKeys = function () { return "/user/api-keys"; };
    UrlService.userFavorites = function () { return "/user/settings/favorites"; };
    UrlService.userProfile = function (username) { return "/profile/".concat(username); };
    UrlService.usage = function () { return "/usage"; };
    UrlService.billing = function () { return "/billing"; };
    UrlService.login = function (returnUrl) {
        var from = "/";
        if (returnUrl) {
            from = returnUrl;
        }
        else if (typeof window !== "undefined") {
            from = window.location.pathname;
        }
        return "/api/auth/login".concat(appendSearchParams({ from: from }));
    };
    UrlService.logout = function () { return "/api/auth/logout"; };
    UrlService.signup = function (returnTo) { return "/api/auth/signup".concat(appendSearchParams({ returnTo: returnTo })); };
    UrlService.onboarding = function (fromSignup) { return "/signup".concat(appendSearchParams({ fromSignup: fromSignup })); };
    UrlService.template = function (id) { return "/template/".concat(id); };
    UrlService.payment = function () { return "/payment"; };
    // Deploy
    UrlService.deploymentList = function () { return "/deployments"; };
    UrlService.deploymentDetails = function (dseq, tab, logsMode) { return "/deployments/".concat(dseq).concat(appendSearchParams({ tab: tab, logsMode: logsMode })); };
    UrlService.templates = function (category, search) { return "/templates".concat(appendSearchParams({ category: category, search: search })); };
    UrlService.templateDetails = function (templateId) { return "/templates/".concat(templateId); };
    UrlService.providers = function (sort) { return "/providers".concat(appendSearchParams({ sort: sort })); };
    UrlService.providerDetail = function (owner) { return "/providers/".concat(owner).concat(appendSearchParams({ network: networkStore_1.default.selectedNetworkId })); };
    UrlService.providerDetailLeases = function (owner) { return "/providers/".concat(owner, "/leases"); };
    UrlService.providerDetailRaw = function (owner) { return "/providers/".concat(owner, "/raw"); };
    UrlService.providerDetailEdit = function (owner) { return "/providers/".concat(owner, "/edit"); };
    UrlService.alerts = function () { return "/alerts"; };
    UrlService.alertDetails = function (id) { return "/alerts/".concat(id); };
    UrlService.notificationChannels = function () { return "/alerts/notification-channels"; };
    UrlService.newNotificationChannel = function () { return "/alerts/notification-channels/new"; };
    UrlService.notificationChannelDetails = function (id) { return "/alerts/notification-channels/".concat(id); };
    UrlService.settings = function () { return "/settings"; };
    UrlService.settingsAuthorizations = function () { return "/settings/authorizations"; };
    // New deployment
    UrlService.newDeployment = function (params) {
        if (params === void 0) { params = {}; }
        var step = params.step, dseq = params.dseq, redeploy = params.redeploy, templateId = params.templateId, gitProviderCode = params.gitProviderCode, gitProvider = params.gitProvider;
        var page = params.page || "new-deployment";
        return "/".concat(page).concat(appendSearchParams({ dseq: dseq, step: step, templateId: templateId, redeploy: redeploy, gitProvider: gitProvider, code: gitProviderCode }));
    };
    return UrlService;
}());
exports.UrlService = UrlService;
function appendSearchParams(params) {
    if (params === void 0) { params = {}; }
    var urlParams = new URLSearchParams("");
    Object.keys(params).forEach(function (p) {
        var value = params[p];
        if (value) {
            urlParams.set(p, value.toString());
        }
    });
    var res = urlParams.toString();
    return res ? "?".concat(res) : res;
}
function removeEmptyFilters(obj) {
    var copy = __assign({}, obj);
    Object.keys(copy).forEach(function (key) {
        if (copy[key] === "*") {
            delete copy[key];
        }
    });
    return copy;
}
function handleDocClick(ev, url) {
    ev.preventDefault();
    window.open(url, "_blank");
}
