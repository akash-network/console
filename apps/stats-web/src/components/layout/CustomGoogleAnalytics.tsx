"use client";

import { useReportWebVitals } from "next/web-vitals";
import { event, GoogleAnalytics as GAnalytics } from "nextjs-google-analytics";

import { browserEnvConfig } from "@/config/browser-env.config";

export default function GoogleAnalytics() {
  useReportWebVitals(({ id, name, label, value }) => {
    event(name, {
      category: label === "web-vital" ? "Web Vitals" : "Next.js custom metric",
      value: Math.round(name === "CLS" ? value * 1000 : value), // values must be integers
      label: id, // id unique to current page load
      nonInteraction: true // avoids affecting bounce rate.
    });
  });

  return <>{browserEnvConfig.NEXT_PUBLIC_NODE_ENV === "production" && <GAnalytics trackPageViews />}</>;
}
