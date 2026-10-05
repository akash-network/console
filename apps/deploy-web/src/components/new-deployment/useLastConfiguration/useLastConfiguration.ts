import { useEffect, useMemo, useState } from "react";

import { useWallet } from "@src/context/WalletProvider";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { isUsableDeploymentDefinition, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useDeploymentsListQuery } from "@src/queries/useDeploymentsListQuery";
import type { ListedDeploymentDto } from "@src/types/deployment";

/** Bounds how many deployment reads one visit can trigger while older deployments turn out to have no configuration. */
export const MAX_LAST_CONFIGURATION_CANDIDATES = 5;

export const DEPENDENCIES = { useWallet, useDeploymentsListQuery, useDeploymentDefinition };

export interface LastConfiguration {
  deployment: ListedDeploymentDto;
  definition: DeploymentDefinition & { sdl: string };
}

/** The newest deployment, open or closed, that the console holds a redeployable configuration for. */
export function useLastConfiguration(dependencies = DEPENDENCIES): LastConfiguration | null {
  const d = dependencies;
  const { hasWallet } = d.useWallet();
  const newestPage = { search: "", skip: 0, limit: MAX_LAST_CONFIGURATION_CANDIDATES };
  const active = d.useDeploymentsListQuery({ state: "active", ...newestPage }, { enabled: hasWallet });
  const closed = d.useDeploymentsListQuery({ state: "closed", ...newestPage }, { enabled: hasWallet });
  const [dseqsWithoutConfiguration, setDseqsWithoutConfiguration] = useState<ReadonlySet<string>>(() => new Set());

  const candidate = useMemo(() => {
    const newest = [...(active.data?.deployments ?? []), ...(closed.data?.deployments ?? [])].sort(byNewestFirst).slice(0, MAX_LAST_CONFIGURATION_CANDIDATES);
    return newest.find(deployment => !dseqsWithoutConfiguration.has(deployment.dseq));
  }, [active.data, closed.data, dseqsWithoutConfiguration]);

  const definition = d.useDeploymentDefinition(candidate?.dseq, { acceptReferences: true });
  const isResolved = definition.source !== "resolving";
  const isUsable = isUsableDeploymentDefinition(definition);

  useEffect(
    function moveOnFromDeploymentWithoutConfiguration() {
      if (candidate && isResolved && !isUsable) {
        setDseqsWithoutConfiguration(current => new Set(current).add(candidate.dseq));
      }
    },
    [candidate, isResolved, isUsable]
  );

  if (!candidate || !isUsableDeploymentDefinition(definition)) return null;
  return { deployment: candidate, definition };
}

function byNewestFirst(a: ListedDeploymentDto, b: ListedDeploymentDto): number {
  return Number(BigInt(b.dseq) - BigInt(a.dseq));
}
