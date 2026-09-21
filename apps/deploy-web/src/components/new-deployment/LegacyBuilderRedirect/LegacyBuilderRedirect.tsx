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

/** The builder step the picker itself lived on, which its canonical and shared links still name. */
const PICKER_STEP = "choose-template";

/** A redeploy goes to its deployment, a deployment mid-creation resumes on Configure, a template opens there, and every other builder link (git or blank editor) starts a blank Configure. */
export function legacyBuilderDestination(query: ParsedUrlQuery, urlService: typeof UrlService): string | null {
  const step = stringParam(query.step);
  const templateId = stringParam(query.templateId);
  const redeploy = deploymentId(query.redeploy);
  const dseq = deploymentId(query.dseq);
  const gitIntent = [query.gitProvider, query.repoUrl, query.code, query.state].map(stringParam);
  const builderStep = step === PICKER_STEP ? undefined : step;
  const named = [builderStep, templateId, stringParam(query.redeploy), stringParam(query.dseq), ...gitIntent];
  const namesBuilderIntent = named.some(value => value !== undefined);

  if (!namesBuilderIntent) return null;
  if (redeploy) return urlService.deploymentDetails(redeploy);
  if (dseq) return urlService.configureDeployment({ dseq });
  if (templateId) return urlService.configureDeployment({ templateId });
  return urlService.configureDeployment({});
}

/** A dseq is a block height, and both destinations put it in a path segment, so anything else would steer the redirect off its own route. */
function deploymentId(value: string | string[] | undefined): string | undefined {
  const candidate = stringParam(value);
  return candidate !== undefined && /^\d+$/.test(candidate) ? candidate : undefined;
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
