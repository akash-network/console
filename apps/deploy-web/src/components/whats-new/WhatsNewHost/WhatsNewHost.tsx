"use client";
import { useCallback, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";

import { canManageProjects } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { whatsNewViewAtom } from "@src/store/whatsNewStore";
import { UrlService } from "@src/utils/urlUtils";
import { organizationsRelease } from "../organizationsRelease";
import type { Box } from "../SpotlightTour/placeCoachCard";
import type { TourOutcome } from "../SpotlightTour/SpotlightTour";
import { SpotlightTour } from "../SpotlightTour/SpotlightTour";
import { WhatsNewModal } from "../WhatsNewModal/WhatsNewModal";

export const DEPENDENCIES = { useFlag, useActiveOrganization, useRouter, usePathname, WhatsNewModal, SpotlightTour };

type Props = { dependencies?: typeof DEPENDENCIES };

/** Mounted above the pages so the tour survives the navigation its steps trigger. */
export function WhatsNewHost({ dependencies: d = DEPENDENCIES }: Props) {
  const isOrganizationsEnabled = d.useFlag("organizations");
  if (!isOrganizationsEnabled) return null;
  return <WhatsNewHostContent dependencies={d} />;
}

function WhatsNewHostContent({ dependencies: d }: Required<Props>) {
  const [view, setView] = useAtom(whatsNewViewAtom);
  const [tourOrigin, setTourOrigin] = useState<Box | null>(null);
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const router = d.useRouter();
  const pathname = d.usePathname();
  const { analyticsService } = useServices();
  const role = activeOrganization?.role;

  const release = useMemo(
    () =>
      organizationsRelease({
        isInTeam: projectsEnabled,
        canManageProjects: !!role && canManageProjects(role),
        showProjects: () => {
          if (pathname !== UrlService.projects()) router.push(UrlService.projects());
        }
      }),
    [projectsEnabled, role, pathname, router]
  );

  const closeAnnouncement = useCallback(() => setView(null), [setView]);

  const startTour = (cardBox: Box | null) => {
    setTourOrigin(cardBox);
    setView("tour");
    release.tour[0].prepare?.();
    analyticsService.track("whats_new_tour_started", { category: "user", release: release.id, steps: release.tour.length });
  };

  const endTour = useCallback(
    ({ stepId, isCompleted }: TourOutcome) => {
      setView(null);
      analyticsService.track("whats_new_tour_ended", { category: "user", release: release.id, step: stepId, completed: isCompleted });
    },
    [setView, analyticsService, release.id]
  );

  return (
    <>
      <d.WhatsNewModal
        release={release}
        isOpen={view === "announcement"}
        isHandingOffToTour={view === "tour"}
        onClose={closeAnnouncement}
        onTryIt={startTour}
      />
      <d.SpotlightTour steps={release.tour} isOpen={view === "tour"} origin={tourOrigin} onEnd={endTour} />
    </>
  );
}
