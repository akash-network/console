"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTopBanner = useTopBanner;
exports.useChainMaintenanceDetails = useChainMaintenanceDetails;
var react_1 = require("react");
var client_1 = require("@unleash/nextjs/client");
var jotai_1 = require("jotai");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useHasCreditCardBanner_1 = require("@src/hooks/useHasCreditCardBanner");
var useWhen_1 = require("@src/hooks/useWhen");
var SettingsProvider_1 = require("../context/SettingsProvider");
var IS_MAINTENANCE_ATOM = (0, jotai_1.atom)(false);
function useTopBanner() {
    var maintenanceBannerFlag = (0, client_1.useVariant)("maintenance_banner");
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var hasCreditCardBanner = (0, useHasCreditCardBanner_1.useHasCreditCardBanner)();
    var _a = (0, jotai_1.useAtom)(IS_MAINTENANCE_ATOM), isMaintenanceBannerOpen = _a[0], setIsMaintenanceBannerOpen = _a[1];
    (0, useWhen_1.useWhen)(maintenanceBannerFlag.enabled, function () { return setIsMaintenanceBannerOpen(true); });
    var hasBanner = (0, react_1.useMemo)(function () { return isMaintenanceBannerOpen || settings.isBlockchainDown || hasCreditCardBanner; }, [isMaintenanceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]);
    return (0, react_1.useMemo)(function () { return ({
        hasBanner: hasBanner,
        isMaintenanceBannerOpen: isMaintenanceBannerOpen,
        setIsMaintenanceBannerOpen: setIsMaintenanceBannerOpen,
        isBlockchainDown: settings.isBlockchainDown,
        hasCreditCardBanner: hasCreditCardBanner
    }); }, [hasBanner, isMaintenanceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]);
}
function useChainMaintenanceDetails() {
    var _a;
    var maintenanceBannerFlag = (0, client_1.useVariant)("maintenance_banner");
    var errorHandler = (0, ServicesProvider_1.useServices)().errorHandler;
    try {
        var details = (maintenanceBannerFlag === null || maintenanceBannerFlag === void 0 ? void 0 : maintenanceBannerFlag.enabled) ? JSON.parse((_a = maintenanceBannerFlag.payload) === null || _a === void 0 ? void 0 : _a.value) : { date: "" };
        if (details.date && Number.isNaN(new Date(details.date).getTime())) {
            throw new Error("Invalid chain maintenance date. Fallback to nothing.");
        }
        return details;
    }
    catch (error) {
        errorHandler.reportError({
            error: error,
            message: "Failed to parse chain maintenance details from feature flag",
            tags: { category: "chain-maintenance" }
        });
        return { date: "" };
    }
}
