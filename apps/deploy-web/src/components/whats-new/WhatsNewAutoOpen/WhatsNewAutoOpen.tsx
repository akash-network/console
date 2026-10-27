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

const OPEN_DIALOG_OR_MENU = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]';

/** Announces the release once, shortly after a page with the full navigation settles. */
export function WhatsNewAutoOpen({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const pathname: string | null = d.usePathname();
  const { isLoading: isOrganizationLoading, isError: hasOrganizationFailedToLoad } = d.useActiveOrganization();
  const seenReleases = useAtomValue(seenWhatsNewReleasesAtom);
  const view = useAtomValue(whatsNewViewAtom);
  const openWhatsNew = d.useOpenWhatsNew();
  const isOnFreePage = pathname !== null && !MID_TASK_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const isOrganizationKnown = !isOrganizationLoading && !hasOrganizationFailedToLoad;
  const shouldAnnounce = isOrganizationKnown && isOnFreePage && !view && !seenReleases.includes(ORGANIZATIONS_RELEASE_ID);

  useEffect(
    function announceOnceThePageSettles() {
      if (!shouldAnnounce) return;
      let timeout: ReturnType<typeof setTimeout>;
      const announceUnlessADialogOrMenuIsOpen = () => {
        if (document.querySelector(OPEN_DIALOG_OR_MENU)) timeout = setTimeout(announceUnlessADialogOrMenuIsOpen, ANNOUNCE_AFTER_MS);
        else openWhatsNew("first_visit");
      };
      timeout = setTimeout(announceUnlessADialogOrMenuIsOpen, ANNOUNCE_AFTER_MS);
      return function cancelAnnouncement() {
        clearTimeout(timeout);
      };
    },
    [shouldAnnounce, openWhatsNew]
  );

  return null;
}
