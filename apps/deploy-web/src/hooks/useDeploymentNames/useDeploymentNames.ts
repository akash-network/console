import { useCallback, useMemo } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { useQueries } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useDeploymentNameBackfill } from "@src/hooks/useDeploymentNameBackfill/useDeploymentNameBackfill";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useServices, useDeploymentNameBackfill };

/** The api refuses a lookup naming more deployments than this, so a longer list is split into several. */
export const MAX_DSEQS_PER_NAMES_LOOKUP = 100;

/** Mirrors the api's MAX_SEARCHABLE_DEPLOYMENTS: a surface holding more is left unnamed rather than fanned out into hundreds of lookups. */
export const MAX_NAMED_DEPLOYMENTS = 5000;

type Dseq = string | number | null | undefined;

export interface DeploymentNames {
  /** The api's name first, then this browser's record, then null so each surface keeps its own placeholder. */
  getDeploymentName: (dseq: Dseq) => string | null;
}

type NamesLookup = { data: Record<string, string | null> } | null;

/** A refusal or an offline browser is neither a bug nor a reason to leave a named deployment unnamed; a server fault is reported like any other. */
function recoverWithNoNames(error: Error): null {
  if (error instanceof ApiError && error.status >= 500) throw error;

  return null;
}

/** Sorted and deduplicated, so the same deployments asked about in any order share one cache entry. */
function normalizeDseqs(dseqs: ReadonlyArray<Dseq>): string[] {
  const present = dseqs.filter((dseq): dseq is string | number => dseq !== null && dseq !== undefined && dseq !== "");

  return [...new Set(present.map(String))].sort();
}

function splitIntoLookups(dseqs: string[]): string[][] {
  const lookups: string[][] = [];
  if (dseqs.length > MAX_NAMED_DEPLOYMENTS) return lookups;

  for (let start = 0; start < dseqs.length; start += MAX_DSEQS_PER_NAMES_LOOKUP) {
    lookups.push(dseqs.slice(start, start + MAX_DSEQS_PER_NAMES_LOOKUP));
  }

  return lookups;
}

function collectNames(lookups: Array<{ data?: NamesLookup }>): Map<string, string | null> {
  const names = new Map<string, string | null>();

  for (const lookup of lookups) {
    for (const [dseq, name] of Object.entries(lookup.data?.data ?? {})) {
      names.set(dseq, name);
    }
  }

  return names;
}

/** The names of many deployments at once as the console api holds them, falling back to this browser's own record only where the api holds none. */
export function useDeploymentNames(dseqs: ReadonlyArray<Dseq>, dependencies = DEPENDENCIES): DeploymentNames {
  const { api, deploymentLocalStorage } = dependencies.useServices();
  /** Read from the store rather than `useWallet`, so surfaces mounted outside the wallet provider resolve their records too. */
  const address = useAtomValue(settingsIdAtom);
  const lookupKey = normalizeDseqs(dseqs).join(",");
  const lookups = useMemo(() => splitIntoLookups(lookupKey ? lookupKey.split(",") : []), [lookupKey]);
  const apiNames = useQueries({
    queries: lookups.map(dseq => api.v1.listDeploymentNames.queryOptions({ dseq }, { catchError: recoverWithNoNames })),
    combine: collectNames
  });

  dependencies.useDeploymentNameBackfill([...apiNames].map(([dseq, name]) => ({ dseq, name })));

  const getDeploymentName = useCallback(
    (dseq: Dseq) => {
      if (dseq === null || dseq === undefined || dseq === "") return null;

      return apiNames.get(String(dseq)) ?? deploymentLocalStorage.get(address, dseq)?.name ?? null;
    },
    [apiNames, deploymentLocalStorage, address]
  );

  return { getDeploymentName };
}
