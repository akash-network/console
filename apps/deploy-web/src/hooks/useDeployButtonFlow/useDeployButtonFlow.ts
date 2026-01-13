import { useCallback, useMemo } from "react";
import { useSearchParams as useSearchParamsOriginal } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  useSearchParams: useSearchParamsOriginal,
  window: typeof window === "undefined" ? undefined : window
};

export type UseDeployButtonFlowOptions = {
  dependencies?: typeof DEPENDENCIES;
};

export interface DeployButtonFlowParams<R extends string | null = string | null> {
  repoUrl: R;
  branch: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  installCommand: string | null;
  buildDirectory: string | null;
  nodeVersion: string | null;
  templateId: string | null;
}

export interface DeployButtonUrlParams {
  repoUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  installCommand?: string;
  buildDirectory?: string;
  nodeVersion?: string;
  templateId?: string;
}

export type DeployButtonFlowResult = (
  | {
      /** Whether this is a deploy button flow (has repoUrl) */
      isDeployButtonFlow: true;
      /** All deploy button parameters - repoUrl is guaranteed to be non-null */
      params: DeployButtonFlowParams<string>;
    }
  | {
      /** Whether this is a deploy button flow (has repoUrl) */
      isDeployButtonFlow: false;
      /** All deploy button parameters */
      params: DeployButtonFlowParams<null>;
    }
) & {
  /** Builds a returnUrl for redirects (e.g., for onboarding flow) */
  buildReturnUrl: (options?: { step?: string; gitProvider?: string }) => string;
  /** Builds URL parameters object with only defined (non-null) values */
  buildUrlParams: () => DeployButtonUrlParams;
};

/**
 * Hook to manage deploy button flow state and parameters.
 * Centralizes all logic for reading and processing deploy button URL parameters.
 */
export const useDeployButtonFlow = ({ dependencies: d = DEPENDENCIES }: UseDeployButtonFlowOptions = {}): DeployButtonFlowResult => {
  const searchParams = d.useSearchParams();

  const targetUrl = useMemo(() => {
    if (typeof d.window === "undefined") return null;

    const raw = searchParams.get("returnTo") || searchParams.get("from") || d.window.location.href;

    return new URL(raw, d.window.location.origin);
  }, [searchParams, d?.window]);

  const getParam = useCallback((key: string) => targetUrl?.searchParams.get(key) || null, [targetUrl]);
  const params = useMemo<DeployButtonFlowParams>(
    () => ({
      repoUrl: getParam("repoUrl"),
      branch: getParam("branch"),
      buildCommand: getParam("buildCommand"),
      startCommand: getParam("startCommand"),
      installCommand: getParam("installCommand"),
      buildDirectory: getParam("buildDirectory"),
      nodeVersion: getParam("nodeVersion"),
      templateId: getParam("templateId")
    }),
    [getParam]
  );

  const { repoUrl } = params;
  const isDeployButtonFlow = !!repoUrl;

  const buildUrlParams = useMemo(
    () => (): DeployButtonUrlParams => {
      const urlParams: DeployButtonUrlParams = {};
      if (params.repoUrl) urlParams.repoUrl = params.repoUrl;
      if (params.branch) urlParams.branch = params.branch;
      if (params.buildCommand) urlParams.buildCommand = params.buildCommand;
      if (params.startCommand) urlParams.startCommand = params.startCommand;
      if (params.installCommand) urlParams.installCommand = params.installCommand;
      if (params.buildDirectory) urlParams.buildDirectory = params.buildDirectory;
      if (params.nodeVersion) urlParams.nodeVersion = params.nodeVersion;
      if (params.templateId) urlParams.templateId = params.templateId;
      return urlParams;
    },
    [
      params.repoUrl,
      params.branch,
      params.buildCommand,
      params.startCommand,
      params.installCommand,
      params.buildDirectory,
      params.nodeVersion,
      params.templateId
    ]
  );

  const buildReturnUrl = useCallback(
    (options?: { step?: string; gitProvider?: string }): string =>
      isDeployButtonFlow && repoUrl
        ? UrlService.newDeployment({
            templateId: CI_CD_TEMPLATE_ID,
            ...buildUrlParams(),
            step: (options?.step as RouteStep) || RouteStep.editDeployment,
            gitProvider: options?.gitProvider || "github"
          })
        : "/",
    [isDeployButtonFlow, repoUrl, buildUrlParams]
  );

  return useMemo(() => {
    const commonResult: Omit<DeployButtonFlowResult, "isDeployButtonFlow" | "params"> = {
      buildReturnUrl,
      buildUrlParams
    };

    if (typeof repoUrl === "string") {
      return {
        isDeployButtonFlow: true,
        params: { ...params, repoUrl },
        ...commonResult
      };
    }

    return {
      isDeployButtonFlow: false,
      params: {
        ...params,
        repoUrl: null
      },
      ...commonResult
    };
  }, [buildReturnUrl, buildUrlParams, repoUrl, params]);
};
