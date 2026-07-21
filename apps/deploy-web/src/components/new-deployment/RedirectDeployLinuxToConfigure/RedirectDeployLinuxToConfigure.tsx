"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, UrlService };

type Props = { dependencies?: typeof DEPENDENCIES };

/**
 * The Container-VM experience lives on the configure screen as a `vm=true` seed, so every visit to the classic
 * `/deploy-linux` route is replaced there. Intentionally client-only, matching
 * {@link RedirectMappableBuilderToConfigure} (the team is phasing getServerSideProps out).
 */
export function RedirectDeployLinuxToConfigure({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const router = d.useRouter();

  useEffect(
    function redirectDeployLinuxToConfigure() {
      router.replace(d.UrlService.configureDeployment({ vm: true }));
    },
    [router, d.UrlService]
  );

  return <Loading text="" />;
}
