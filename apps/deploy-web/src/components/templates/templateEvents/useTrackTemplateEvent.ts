import { useEffect, useRef } from "react";

import { useServices } from "@src/context/ServicesProvider";
import type { TemplateEventSubject } from "./templateEvents";

export type TemplateEventName = "template_page_viewed" | "template_configure_opened";

export const DEPENDENCIES = { useServices };

/** Sends a template event once for each template the caller names, and nothing while it names none: a page still loading, or the marketplace switched off. */
export function useTrackTemplateEvent(eventName: TemplateEventName, subject: TemplateEventSubject | undefined, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { analyticsService, networkStore } = d.useServices();
  const network = networkStore.useSelectedNetworkId();
  const trackedTemplateId = useRef<string>();
  const source = subject?.source;
  const templateId = subject?.templateId;
  const templateVersion = subject?.templateVersion;

  useEffect(
    function trackTheTemplateOnce() {
      if (!source || !templateId || templateVersion === undefined || trackedTemplateId.current === templateId) return;
      trackedTemplateId.current = templateId;
      analyticsService.track(eventName, { source, template_id: templateId, template_version: templateVersion, network }, "Amplitude");
    },
    [eventName, source, templateId, templateVersion, network, analyticsService]
  );
}
