"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";

import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, UrlService };

type Props = { children: ReactNode; dependencies?: typeof DEPENDENCIES };

/**
 * The retired deployment builder lived under `/new-deployment` with its intent in the query. Links into it still
 * exist (bookmarks, template pages, README badges), so any query that named a builder step is redirected to where
 * that intent lives now; a bare `/new-deployment` is the picker and renders its children.
 */
export function LegacyBuilderRedirect({ children, dependencies: d = DEPENDENCIES }: Props) {
  const router = d.useRouter();
  const destination = legacyBuilderDestination(router.query, d.UrlService);

  useEffect(
    function redirectRetiredBuilderLink() {
      if (destination) router.replace(destination);
    },
    [destination, router]
  );

  if (destination) return <BootLoading />;
  return <>{children}</>;
}

/** A template opens on Configure, a deployment mid-creation resumes there, a redeploy goes to its deployment, and every other builder link (git or blank editor) starts a blank Configure. */
export function legacyBuilderDestination(query: ParsedUrlQuery, urlService: typeof UrlService): string | null {
  const step = stringParam(query.step);
  const templateId = stringParam(query.templateId);
  const redeploy = stringParam(query.redeploy);
  const dseq = stringParam(query.dseq);
  const gitIntent = [query.gitProvider, query.repoUrl, query.code, query.state].map(stringParam);
  const namesBuilderIntent = [step, templateId, redeploy, dseq, ...gitIntent].some(value => value !== undefined);

  if (!namesBuilderIntent) return null;
  if (redeploy) return urlService.deploymentDetails(redeploy);
  if (templateId) return urlService.configureDeployment({ templateId });
  if (dseq) return urlService.configureDeployment({ dseq });
  return urlService.configureDeployment({});
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
