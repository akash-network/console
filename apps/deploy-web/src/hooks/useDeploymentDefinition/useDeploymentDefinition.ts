import { useMemo } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import { QueryKeys } from "@src/queries/queryKeys";
import { deploymentData } from "@src/utils/deploymentData";
import { hasSdlReference, isStoredSdlRedeployable, isStoredSdlSelfContained, withEnvValuesFrom } from "@src/utils/sdl/storedDefinition";

/** `absent` still carries the API's copy when it held one it could not stand behind, so the shape is visible even though the values are not. */
export type DeploymentDefinitionSource = "resolving" | "api" | "local" | "absent";

export interface DeploymentDefinition {
  sdl: string | undefined;
  name: string | undefined;
  source: DeploymentDefinitionSource;
  /** Present only beside the api's own copy, being the version that copy was recorded under and the one a patch of it is guarded on. */
  manifestVersion?: string;
  /** Whether the console holds a definition of its own, usable here or not; unknown until the api has answered. */
  isRecordedByConsole?: boolean;
  /** The api's copy with the env values it withholds filled from this browser, present only while this browser's copy is the one the chain runs. */
  restoredSdl?: string;
}

const USABLE_SOURCES: readonly DeploymentDefinitionSource[] = ["api", "local"];

/** An absent definition can still carry the API's rejected SDL for inspection, so views must gate on the source, not on SDL presence. */
export function isUsableDeploymentDefinition(definition: DeploymentDefinition): definition is DeploymentDefinition & { sdl: string } {
  return !!definition.sdl && USABLE_SOURCES.includes(definition.source);
}

/** A redeploy seeds Configure with the values this browser gave back, so the new deployment stores them as plain variables. */
export function sdlToRedeploy(definition: DeploymentDefinition): string | undefined {
  return definition.restoredSdl ?? definition.sdl;
}

/** A copy this browser cannot hash is treated as one the chain does not run, rather than reported. */
function useManifestVersionOf(sdl: string | undefined): { version: string | null | undefined; isReading: boolean } {
  const query = useQuery({
    queryKey: QueryKeys.getManifestVersionKey(sdl),
    queryFn: () => deploymentData.getManifestVersion(yaml.load(sdl ?? "")).catch(() => null),
    enabled: !!sdl,
    staleTime: Infinity
  });

  return { version: query.data, isReading: query.isLoading };
}

export const DEPENDENCIES = { useServices, useWallet, useResolvedDeploymentName, useFlag, useManifestVersionOf };

export interface DeploymentDefinitionOptions {
  /** Takes the api's copy even where it withholds values as references, for a caller that hands the SDL to Configure rather than signing it, and only while the secrets feature can resolve them. */
  acceptReferences?: boolean;
}

/** A server fault is reported like any other; a refusal or an offline browser is neither a bug nor a reason to fail the view. */
export function catchDeploymentReadError(error: Error): null {
  if (error instanceof ApiError && error.status >= 500) throw error;
  return null;
}

/** A deployment's SDL, from the console API when that copy is the one the chain is running, and from this browser otherwise. */
export function useDeploymentDefinition(
  dseq: string | undefined | null,
  options: DeploymentDefinitionOptions = {},
  dependencies = DEPENDENCIES
): DeploymentDefinition {
  const { api, deploymentLocalStorage } = dependencies.useServices();
  const { address } = dependencies.useWallet();

  const query = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: !!dseq,
      catchError: catchDeploymentReadError,
      /** Selects the cached object as-is: building a new one here would hand react-query a fresh identity every render. */
      select: response => response?.data ?? null
    }
  );

  const isResolving = !!dseq && query.isLoading;
  const consoleSettings = query.data?.consoleSettings;
  const apiSdl = consoleSettings?.sdl;
  const recordedManifestVersion = consoleSettings?.manifestVersion;
  /**
   * The console is told about an update through its own endpoint, which the update tab does not call: it signs and
   * ships the manifest itself. So a recorded SDL can describe a manifest version the chain has already moved past,
   * and serving it would present a superseded document as authoritative and re-ship it on the next update.
   */
  const chainManifestVersion = query.data?.deployment?.hash;
  const isApiCopyOnChain = !!recordedManifestVersion && recordedManifestVersion === chainManifestVersion;
  const localSdl = deploymentLocalStorage.get(address, dseq)?.manifest;
  const isRecordedByConsole = query.data ? !!consoleSettings : undefined;
  const name = dependencies.useResolvedDeploymentName(dseq);
  /** Nothing resolves a reference with the feature off, so the api's copy is only preferred over this browser's while it is on. */
  const acceptReferences = !!options.acceptReferences && dependencies.useFlag("ui_deployment_secrets");
  const mayRestoreFromBrowser = useMemo(
    () => acceptReferences && isApiCopyOnChain && !!apiSdl && !!localSdl && hasSdlReference(apiSdl),
    [acceptReferences, isApiCopyOnChain, apiSdl, localSdl]
  );
  const browserCopyVersion = dependencies.useManifestVersionOf(mayRestoreFromBrowser ? localSdl : undefined);
  const isReadingBrowserCopy = mayRestoreFromBrowser && browserCopyVersion.isReading;
  const isBrowserCopyOnChain = mayRestoreFromBrowser && browserCopyVersion.version === chainManifestVersion;

  return useMemo(() => {
    const isApiCopyUsable = acceptReferences ? isStoredSdlRedeployable : isStoredSdlSelfContained;
    if (isResolving || isReadingBrowserCopy) return { sdl: undefined, name, source: "resolving" };
    if (apiSdl && isApiCopyOnChain && isApiCopyUsable(apiSdl)) {
      const restoredSdl = isBrowserCopyOnChain && localSdl ? withEnvValuesFrom(localSdl, apiSdl) : undefined;
      return { sdl: apiSdl, name, source: "api", manifestVersion: recordedManifestVersion, isRecordedByConsole, ...(restoredSdl ? { restoredSdl } : {}) };
    }
    if (localSdl) return { sdl: localSdl, name, source: "local", isRecordedByConsole };
    return { sdl: apiSdl, name, source: "absent", isRecordedByConsole };
  }, [
    isResolving,
    isReadingBrowserCopy,
    isBrowserCopyOnChain,
    apiSdl,
    recordedManifestVersion,
    isApiCopyOnChain,
    acceptReferences,
    localSdl,
    name,
    isRecordedByConsole
  ]);
}
