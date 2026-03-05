"use client";
import { useEffect } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { addScriptToBody } from "@src/utils/domUtils";

export const TrackingScripts = () => {
  const { publicConfig } = useServices();
  const isProduction = publicConfig.NEXT_PUBLIC_NODE_ENV === "production";

  useEffect(() => {
    const shouldShowTracking = publicConfig.NEXT_PUBLIC_TRACKING_ENABLED;
    const shouldShowGrowthChannel = publicConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED;

    if (isProduction && shouldShowTracking) {
      // Google Tag Manager
      addScriptToBody({
        id: "gtm",
        type: "text/javascript",
        innerHTML: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${publicConfig.NEXT_PUBLIC_GTM_ID}');
        `
      });

      // GTM noscript fallback
      const gtmNoscript = document.createElement("noscript");
      const gtmIframe = document.createElement("iframe");
      gtmIframe.src = `https://www.googletagmanager.com/ns.html?id=${publicConfig.NEXT_PUBLIC_GTM_ID}`;
      gtmIframe.height = "0";
      gtmIframe.width = "0";
      gtmIframe.style.display = "none";
      gtmIframe.style.visibility = "hidden";
      gtmNoscript.appendChild(gtmIframe);
      document.body.appendChild(gtmNoscript);
    }

    if (isProduction && shouldShowTracking && shouldShowGrowthChannel) {
      // Growth Channel tracking
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
