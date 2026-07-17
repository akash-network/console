"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, UrlService };

type Props = { children: ReactNode; dependencies?: typeof DEPENDENCIES };

/**
 * Client-side redirect for inbound/external links to the classic builder. When the `/new-deployment` query is a
 * mappable intent (template or blank editor, not git/redeploy), it replaces to the configure screen.
 * Intentionally client-only — no SSR (the team is phasing getServerSideProps out).
 *
 * The CI/CD template is a git/remote-deploy intent that `NewDeploymentContainer` opens as such (keyed on
 * `CI_CD_TEMPLATE_ID`), and a bare `/new-deployment?templateId=<CI_CD_TEMPLATE_ID>` link (no git query params)
 * reaches it — so it is excluded here to let the container handle it rather than redirecting to configure, which
 * can't represent that intent.
 */
export function RedirectMappableBuilderToConfigure({ children, dependencies: d = DEPENDENCIES }: Props) {
  const router = d.useRouter();
  const step = typeof router.query.step === "string" ? router.query.step : undefined;
  const templateId = typeof router.query.templateId === "string" ? router.query.templateId : undefined;
  const hasRedeploy = typeof router.query.redeploy === "string";
  const hasGitProvider = typeof router.query.gitProvider === "string";
  const hasRepoUrl = typeof router.query.repoUrl === "string";
  const isCiCdTemplate = templateId === CI_CD_TEMPLATE_ID;
  const shouldRedirect = !hasRedeploy && !hasGitProvider && !hasRepoUrl && !isCiCdTemplate && (step === "edit-deployment" || !!templateId);

  useEffect(
    function redirectLegacyBuilderToConfigure() {
      if (shouldRedirect) router.replace(d.UrlService.configureDeployment({ templateId }));
    },
    [shouldRedirect, templateId, router, d.UrlService]
  );

  if (shouldRedirect) return <Loading text="" />;
  return <>{children}</>;
}
