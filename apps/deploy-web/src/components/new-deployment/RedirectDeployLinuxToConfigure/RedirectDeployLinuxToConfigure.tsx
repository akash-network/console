"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useRouter, UrlService };

type Props = { children: ReactNode; dependencies?: typeof DEPENDENCIES };

/**
 * Client-side redirect for the classic `/deploy-linux` SSH-VM builder. With the redesign flag on, the
 * Container-VM experience lives on the configure screen as a `vm=true` seed, so every visit is replaced
 * there; flag off renders the classic builder untouched. Intentionally client-only, matching
 * {@link RedirectMappableBuilderToConfigure} (the team is phasing getServerSideProps out).
 */
export function RedirectDeployLinuxToConfigure({ children, dependencies: d = DEPENDENCIES }: Props) {
  const isRedesignEnabled = d.useFlag("onboarding_redesign_v1");
  const router = d.useRouter();

  useEffect(
    function redirectDeployLinuxToConfigure() {
      if (isRedesignEnabled) router.replace(d.UrlService.configureDeployment({ vm: true }));
    },
    [isRedesignEnabled, router, d.UrlService]
  );

  if (isRedesignEnabled) return <Loading text="" />;
  return <>{children}</>;
}
