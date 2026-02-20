import { useEffect } from "react";
import ReactGA from "react-ga4";
import { useLocation } from "react-router-dom";

import { browserEnvConfig } from "@/config/browser-env.config";

let initialized = false;

export default function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (browserEnvConfig.VITE_NODE_ENV === "production" && browserEnvConfig.VITE_GA_MEASUREMENT_ID && !initialized) {
      ReactGA.initialize(browserEnvConfig.VITE_GA_MEASUREMENT_ID);
      initialized = true;
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

  return null;
}
