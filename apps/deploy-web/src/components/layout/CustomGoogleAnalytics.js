"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GoogleAnalytics;
var web_vitals_1 = require("next/web-vitals");
var nextjs_google_analytics_1 = require("nextjs-google-analytics");
var browser_env_config_1 = require("@src/config/browser-env.config");
function GoogleAnalytics() {
    (0, web_vitals_1.useReportWebVitals)(function (_a) {
        var id = _a.id, name = _a.name, label = _a.label, value = _a.value;
        (0, nextjs_google_analytics_1.event)(name, {
            category: label === "web-vital" ? "Web Vitals" : "Next.js custom metric",
            value: Math.round(name === "CLS" ? value * 1000 : value), // values must be integers
            label: id, // id unique to current page load
            nonInteraction: true // avoids affecting bounce rate.
        });
    });
    return <>{!!browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GA_ENABLED && <nextjs_google_analytics_1.GoogleAnalytics trackPageViews/>}</>;
}
