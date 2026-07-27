"use client";
import { useEffect } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { addScriptToBody } from "@src/utils/domUtils";

export const DEPENDENCIES = { useServices };

const GTM_SCRIPT_ID = "gtm";

/**
 * Bootstraps GTM without the stock inline snippet — deploy-web's CSP script-src has no 'unsafe-inline',
 * so the dataLayer is seeded directly and gtm.js loads as an allowlisted external script.
 */
function loadGoogleTagManager(gtmId?: string) {
  if (document.getElementById(GTM_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  addScriptToBody({
    id: GTM_SCRIPT_ID,
    src: `https://www.googletagmanager.com/gtm.js?id=${gtmId}`,
    async: true
  });
  appendGtmNoscriptFallback(gtmId);
}

function appendGtmNoscriptFallback(gtmId?: string) {
  const gtmNoscript = document.createElement("noscript");
  const gtmIframe = document.createElement("iframe");
  gtmIframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
  gtmIframe.height = "0";
  gtmIframe.width = "0";
  gtmIframe.style.display = "none";
  gtmIframe.style.visibility = "hidden";
  gtmNoscript.appendChild(gtmIframe);
  document.body.appendChild(gtmNoscript);
}

export const TrackingScripts = ({ dependencies = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) => {
  const { useServices } = dependencies;
  const { publicConfig } = useServices();
  const isProduction = publicConfig.NEXT_PUBLIC_NODE_ENV === "production";

  useEffect(() => {
    const shouldShowTracking = publicConfig.NEXT_PUBLIC_TRACKING_ENABLED;
    const shouldShowGrowthChannel = publicConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED;

    if (isProduction && shouldShowTracking) {
      loadGoogleTagManager(publicConfig.NEXT_PUBLIC_GTM_ID);
    }

    if (isProduction && shouldShowTracking && shouldShowGrowthChannel) {
      addScriptToBody({
        src: "https://pxl.growth-channel.net/s/8d425860-cf3c-49cf-a459-069a7dc7b1f8",
        async: true,
        id: "growth-channel-script-retargeting"
      });

      addScriptToBody({
        src: "https://pxl.growth-channel.net/s/e94b4a7a-8431-4b9b-a679-290a1dbbab1b",
        async: true,
        id: "growth-channel-script-console"
      });
    }
  }, [isProduction]);

  return null;
};
