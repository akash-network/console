import { useMemo } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { isStoredSdlSelfContained } from "@src/utils/sdl/storedDefinition";

/** `absent` still carries the API's copy when it held one it could not stand behind, so the shape is visible even though the values are not. */
export type DeploymentDefinitionSource = "resolving" | "api" | "local" | "absent";

export interface DeploymentDefinition {
  sdl: string | undefined;
  name: string | undefined;
  source: DeploymentDefinitionSource;
}

export const DEPENDENCIES = { useServices, useWallet };

/** A deployment's SDL, from the console API when that copy is the one the chain is running, and from this browser otherwise. */
export function useDeploymentDefinition(dseq: string | undefined | null, dependencies = DEPENDENCIES): DeploymentDefinition {
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
  const stored = deploymentLocalStorage.get(address, dseq);
  const localSdl = stored?.manifest;
  const name = stored?.name;

  return useMemo(() => {
    if (isResolving) return { sdl: undefined, name: undefined, source: "resolving" };
    if (apiSdl && isApiCopyOnChain && isStoredSdlSelfContained(apiSdl)) return { sdl: apiSdl, name, source: "api" };
    if (localSdl) return { sdl: localSdl, name, source: "local" };
    return { sdl: apiSdl, name, source: "absent" };
  }, [isResolving, apiSdl, isApiCopyOnChain, localSdl, name]);
}
