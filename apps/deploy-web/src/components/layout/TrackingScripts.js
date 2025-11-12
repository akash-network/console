"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingScripts = void 0;
var react_1 = require("react");
var browser_env_config_1 = require("@src/config/browser-env.config");
var domUtils_1 = require("@src/utils/domUtils");
var TrackingScripts = function () {
    var isProduction = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_NODE_ENV === "production";
    (0, react_1.useEffect)(function () {
        var shouldShowTracking = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_TRACKING_ENABLED;
        var shouldShowGrowthChannel = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED;
        if (isProduction && shouldShowTracking) {
            // Google Tag Manager
            (0, domUtils_1.addScriptToBody)({
                id: "gtm",
                type: "text/javascript",
                innerHTML: "\n          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\n          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\n          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n          })(window,document,'script','dataLayer','".concat(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GTM_ID, "');\n        ")
            });
            // GTM noscript fallback
            var gtmNoscript = document.createElement("noscript");
            var gtmIframe = document.createElement("iframe");
            gtmIframe.src = "https://www.googletagmanager.com/ns.html?id=".concat(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GTM_ID);
            gtmIframe.height = "0";
            gtmIframe.width = "0";
            gtmIframe.style.display = "none";
            gtmIframe.style.visibility = "hidden";
            gtmNoscript.appendChild(gtmIframe);
            document.body.appendChild(gtmNoscript);
        }
        if (isProduction && shouldShowTracking && shouldShowGrowthChannel) {
            // Growth Channel tracking
            (0, domUtils_1.addScriptToBody)({
                src: "https://pxl.growth-channel.net/s/8d425860-cf3c-49cf-a459-069a7dc7b1f8",
                async: true,
                id: "growth-channel-script-retargeting"
            });
            (0, domUtils_1.addScriptToBody)({
                src: "https://pxl.growth-channel.net/s/e94b4a7a-8431-4b9b-a679-290a1dbbab1b",
                async: true,
                id: "growth-channel-script-console"
            });
        }
    }, [isProduction]);
    return null;
};
exports.TrackingScripts = TrackingScripts;
