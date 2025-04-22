"use client";
import { useEffect } from "react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { addScriptToBody } from "@src/utils/domUtils";

export const TrackingScripts = () => {
  useEffect(() => {
    const shouldShowTracking = browserEnvConfig.NEXT_PUBLIC_TRACKING_ENABLED;
    const shouldShowLinkedIn = browserEnvConfig.NEXT_PUBLIC_LINKEDIN_TRACKING_ENABLED;
    const shouldShowGrowthChannel = browserEnvConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED;

    if (shouldShowTracking && shouldShowLinkedIn) {
      // LinkedIn tracking
      addScriptToBody({
        id: "linkedin-tracking",
        type: "text/javascript",
        innerHTML: `
          _linkedin_partner_id = "7065786";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);})(window.lintrk);
        `
      });

      // LinkedIn noscript fallback
      const noscript = document.createElement("noscript");
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.alt = "";
      img.src = "https://px.ads.linkedin.com/collect/?pid=7065786&fmt=gif";
      noscript.appendChild(img);
      document.body.appendChild(noscript);
    }

    if (shouldShowTracking && shouldShowGrowthChannel) {
      // Growth Channel tracking
      addScriptToBody({
        src: "https://pxl.growth-channel.net/s/8d425860-cf3c-49cf-a459-069a7dc7b1f8",
        async: true
      });

      addScriptToBody({
        src: "https://pxl.growth-channel.net/s/e94b4a7a-8431-4b9b-a679-290a1dbbab1b",
        async: true
      });
    }
  }, []);

  return null;
};
