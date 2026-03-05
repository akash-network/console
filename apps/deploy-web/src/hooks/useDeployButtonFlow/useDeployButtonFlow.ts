import { useCallback, useMemo } from "react";
import { useSearchParams as useSearchParamsOriginal } from "next/navigation";

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

export type DeployButtonFlowResult =
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
    };

/**
 * Hook to manage deploy button flow state and parameters.
 * Centralizes all logic for reading and processing deploy button URL parameters.
 */
export const useDeployButtonFlow = ({ dependencies: d = DEPENDENCIES }: UseDeployButtonFlowOptions = {}): DeployButtonFlowResult => {
  const searchParams = d.useSearchParams();

  const getParam = useCallback((key: string) => searchParams.get(key) || null, [searchParams]);
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

  return useMemo(() => {
    if (typeof repoUrl === "string") {
      return {
        isDeployButtonFlow: true,
        params: { ...params, repoUrl }
      };
    }

    return {
      isDeployButtonFlow: false,
      params: {
        ...params,
        repoUrl: null
      }
    };
  }, [repoUrl, params]);
};
