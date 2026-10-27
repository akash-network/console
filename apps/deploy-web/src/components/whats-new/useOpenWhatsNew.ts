"use client";
import { useCallback } from "react";
import { useSetAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { seenWhatsNewReleasesAtom, whatsNewViewAtom } from "@src/store/whatsNewStore";
import { ORGANIZATIONS_RELEASE_ID } from "./organizationsRelease";

export type WhatsNewTrigger = "first_visit" | "account_menu";

export function useOpenWhatsNew() {
  const setView = useSetAtom(whatsNewViewAtom);
  const setSeenReleases = useSetAtom(seenWhatsNewReleasesAtom);
  const { analyticsService } = useServices();

  return useCallback(
    (trigger: WhatsNewTrigger) => {
      setSeenReleases(seen => (seen.includes(ORGANIZATIONS_RELEASE_ID) ? seen : [...seen, ORGANIZATIONS_RELEASE_ID]));
      setView("announcement");
      analyticsService.track("whats_new_opened", { category: "user", release: ORGANIZATIONS_RELEASE_ID, trigger });
    },
    [setSeenReleases, setView, analyticsService]
  );
}
