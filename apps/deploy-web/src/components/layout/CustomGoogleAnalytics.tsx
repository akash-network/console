"use client";
import { useReportWebVitals } from "next/web-vitals";
import { event, GoogleAnalytics as GAnalytics } from "nextjs-google-analytics";

import { useServices } from "@src/context/ServicesProvider";

export default function GoogleAnalytics() {
  const { publicConfig } = useServices();
  useReportWebVitals(({ id, name, label, value }) => {
    event(name, {
      category: label === "web-vital" ? "Web Vitals" : "Next.js custom metric",
      value: Math.round(name === "CLS" ? value * 1000 : value), // values must be integers
      label: id, // id unique to current page load
      nonInteraction: true // avoids affecting bounce rate.
    });
  });
  return <>{!!publicConfig.NEXT_PUBLIC_GA_ENABLED && <GAnalytics trackPageViews />}</>;
}
