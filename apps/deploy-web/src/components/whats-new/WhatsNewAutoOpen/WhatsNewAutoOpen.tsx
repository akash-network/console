"use client";
import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { usePathname } from "next/navigation";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { seenWhatsNewReleasesAtom, whatsNewViewAtom } from "@src/store/whatsNewStore";
import { ORGANIZATIONS_RELEASE_ID } from "../organizationsRelease";
import { useOpenWhatsNew } from "../useOpenWhatsNew";

export const DEPENDENCIES = { usePathname, useActiveOrganization, useOpenWhatsNew };

const ANNOUNCE_AFTER_MS = 1100;

/** Announcing over these would pull the user out of a task they are in the middle of. */
const MID_TASK_PATH_PREFIXES = ["/new-deployment", "/invitations", "/onboarding"];

/** Announces the release once, shortly after a page with the full navigation settles. */
export function WhatsNewAutoOpen({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const pathname = d.usePathname() ?? "";
  const { isLoading: isOrganizationLoading } = d.useActiveOrganization();
  const seenReleases = useAtomValue(seenWhatsNewReleasesAtom);
  const view = useAtomValue(whatsNewViewAtom);
  const openWhatsNew = d.useOpenWhatsNew();
  const isMidTask = MID_TASK_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const shouldAnnounce = !isOrganizationLoading && !view && !isMidTask && !seenReleases.includes(ORGANIZATIONS_RELEASE_ID);

  useEffect(
    function announceOnceThePageSettles() {
      if (!shouldAnnounce) return;
      const timeout = setTimeout(() => openWhatsNew("first_visit"), ANNOUNCE_AFTER_MS);
      return function cancelAnnouncement() {
        clearTimeout(timeout);
      };
    },
    [shouldAnnounce, openWhatsNew]
  );

  return null;
}
