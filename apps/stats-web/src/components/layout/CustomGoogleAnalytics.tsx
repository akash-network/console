import { useEffect, useRef } from "react";
import ReactGA from "react-ga4";
import { useLocation } from "react-router-dom";

import { browserEnvConfig } from "@/config/browser-env.config";

export default function GoogleAnalytics() {
  const location = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (browserEnvConfig.VITE_NODE_ENV === "production" && browserEnvConfig.VITE_GA_MEASUREMENT_ID && !initialized.current) {
      ReactGA.initialize(browserEnvConfig.VITE_GA_MEASUREMENT_ID);
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

  return null;
}
