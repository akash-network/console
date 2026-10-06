"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { catchDeploymentReadError, manifestVersionOrNull } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { DeploymentCopy, DeploymentCopyFate, DeploymentRecord } from "./deploymentCopyFate";
import { deploymentCopyFateOf } from "./deploymentCopyFate";

export const DEPENDENCIES = { useServices, useWallet, useQueryClient };

interface CheckedCopy {
  fate: DeploymentCopyFate;
  isActive: boolean;
}

interface CopyAccess {
  recordOf: (dseq: string) => Promise<DeploymentRecord | null>;
  copyOf: (dseq: string) => DeploymentCopy;
  forget: (dseq: string) => void;
}

/**
 * Forgets each copy of a deployment's configuration this browser kept from before the console recorded definitions,
 * once the console holds one that replaces it, and reports what is left so the copies can be retired on data.
 */
export function DeploymentCopyCleanup({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}) {
  const { address } = d.useWallet();
  const { api, deploymentLocalStorage, analyticsService, logger } = d.useServices();
  const queryClient = d.useQueryClient();
  const checkedAddresses = useRef(new Set<string>());

  useEffect(
    function forgetCopiesTheConsoleReplaced() {
      if (!address || checkedAddresses.current.has(address)) return;
      checkedAddresses.current.add(address);

      const dseqs = deploymentLocalStorage.dseqsOf(address);
      if (dseqs.length === 0) return;

      const copies: CopyAccess = {
        recordOf: dseq =>
          queryClient.fetchQuery(api.v1.getDeployment.queryOptions({ dseq }, { catchError: catchDeploymentReadError })).then(
            response => response?.data ?? null,
            () => null
          ),
        copyOf: dseq => deploymentLocalStorage.get(address, dseq) ?? {},
        forget: dseq => deploymentLocalStorage.delete(address, dseq)
      };

      checkCopiesOneAtATime(dseqs, copies).then(
        checked => analyticsService.track("deployment_copies_checked", { category: "deployments", ...countsOf(checked) }),
        error => logger.warn({ event: "DEPLOYMENT_COPY_CLEANUP_FAILED", error })
      );
    },
    [address, api, deploymentLocalStorage, analyticsService, logger, queryClient]
  );

  return null;
}

/** One at a time, so a browser holding many copies does not fire a burst of reads at the api on load. */
async function checkCopiesOneAtATime(dseqs: string[], copies: CopyAccess): Promise<CheckedCopy[]> {
  const checked: CheckedCopy[] = [];
  for (const dseq of dseqs) {
    const record = await copies.recordOf(dseq);
    const fate = await deploymentCopyFateOf(copies.copyOf(dseq), record, manifestVersionOrNull);
    if (fate === "forget") copies.forget(dseq);
    checked.push({ fate, isActive: record?.deployment.state === "active" });
  }
  return checked;
}

function countsOf(checked: CheckedCopy[]) {
  const countOf = (fate: DeploymentCopyFate) => checked.filter(copy => copy.fate === fate).length;

  return {
    copies: checked.length,
    forgotten: countOf("forget"),
    onlyInBrowser: countOf("only-in-browser"),
    onlyInBrowserActive: checked.filter(copy => copy.fate === "only-in-browser" && copy.isActive).length,
    restoresVariables: countOf("restores-variables"),
    holdsName: countOf("holds-name"),
    kept: countOf("keep")
  };
}
