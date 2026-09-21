import { useMemo } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import { isStoredSdlRedeployable, isStoredSdlSelfContained } from "@src/utils/sdl/storedDefinition";

/** `absent` still carries the API's copy when it held one it could not stand behind, so the shape is visible even though the values are not. */
export type DeploymentDefinitionSource = "resolving" | "api" | "local" | "absent";

export interface DeploymentDefinition {
  sdl: string | undefined;
  name: string | undefined;
  source: DeploymentDefinitionSource;
}

const USABLE_SOURCES: readonly DeploymentDefinitionSource[] = ["api", "local"];

/** An absent definition can still carry the API's rejected SDL for inspection, so views must gate on the source, not on SDL presence. */
export function isUsableDeploymentDefinition(definition: DeploymentDefinition): definition is DeploymentDefinition & { sdl: string } {
  return !!definition.sdl && USABLE_SOURCES.includes(definition.source);
}

export const DEPENDENCIES = { useServices, useWallet, useResolvedDeploymentName, useFlag };

export interface DeploymentDefinitionOptions {
  /** Takes the api's copy even where it withholds values as references, for a caller that hands the SDL to Configure rather than signing it, and only while the secrets feature can resolve them. */
  acceptReferences?: boolean;
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
      /** A server fault is reported like any other; a refusal or an offline browser is neither a bug nor a reason to fail the view. */
      catchError(error) {
        if (error instanceof ApiError && error.status >= 500) throw error;
        return null;
      },
      /** Selects the cached object as-is: building a new one here would hand react-query a fresh identity every render. */
      select: response => response?.data ?? null
    }
  );

  const isResolving = !!dseq && query.isLoading;
  const consoleSettings = query.data?.consoleSettings;
  const apiSdl = consoleSettings?.sdl;
  /**
   * The console is told about an update through its own endpoint, which the update tab does not call: it signs and
   * ships the manifest itself. So a recorded SDL can describe a manifest version the chain has already moved past,
   * and serving it would present a superseded document as authoritative and re-ship it on the next update.
   */
  const isApiCopyOnChain = !!consoleSettings?.manifestVersion && consoleSettings.manifestVersion === query.data?.deployment?.hash;
  const localSdl = deploymentLocalStorage.get(address, dseq)?.manifest;
  const name = dependencies.useResolvedDeploymentName(dseq);
  /** Nothing resolves a reference with the feature off, so the api's copy is only preferred over this browser's while it is on. */
  const acceptReferences = !!options.acceptReferences && dependencies.useFlag("ui_deployment_secrets");

  return useMemo(() => {
    const isApiCopyUsable = acceptReferences ? isStoredSdlRedeployable : isStoredSdlSelfContained;
    if (isResolving) return { sdl: undefined, name, source: "resolving" };
    if (apiSdl && isApiCopyOnChain && isApiCopyUsable(apiSdl)) return { sdl: apiSdl, name, source: "api" };
    if (localSdl) return { sdl: localSdl, name, source: "local" };
    return { sdl: apiSdl, name, source: "absent" };
  }, [isResolving, apiSdl, isApiCopyOnChain, acceptReferences, localSdl, name]);
}
