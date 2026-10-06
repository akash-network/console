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
  fate: DeploymentCopyFate | "unreadable";
  isActive: boolean;
}

/** A copy that can't be read or judged is kept and counted, so one bad entry doesn't stop the copies after it from being checked. */
const UNREADABLE_COPY: CheckedCopy = { fate: "unreadable", isActive: false };

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
  const { api, deploymentLocalStorage, analyticsService } = d.useServices();
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

      void checkCopiesOneAtATime(dseqs, copies).then(checked =>
        analyticsService.track("deployment_copies_checked", { category: "deployments", ...countsOf(checked) })
      );
    },
    [address, api, deploymentLocalStorage, analyticsService, queryClient]
  );

  return null;
}

/** One at a time, so a browser holding many copies does not fire a burst of reads at the api on load. */
async function checkCopiesOneAtATime(dseqs: string[], copies: CopyAccess): Promise<CheckedCopy[]> {
  const checked: CheckedCopy[] = [];
  for (const dseq of dseqs) {
    checked.push(await checkCopy(dseq, copies).catch(() => UNREADABLE_COPY));
  }
  return checked;
}

async function checkCopy(dseq: string, copies: CopyAccess): Promise<CheckedCopy> {
  const copy = copies.copyOf(dseq);
  const record = await copies.recordOf(dseq);
  const fate = await deploymentCopyFateOf(copy, record, manifestVersionOrNull);
  if (fate === "forget") copies.forget(dseq);
  return { fate, isActive: record?.deployment.state === "active" };
}

function countsOf(checked: CheckedCopy[]) {
  const countOf = (fate: CheckedCopy["fate"]) => checked.filter(copy => copy.fate === fate).length;

  return {
    copies: checked.length,
    forgotten: countOf("forget"),
    onlyInBrowser: countOf("only-in-browser"),
    onlyInBrowserActive: checked.filter(copy => copy.fate === "only-in-browser" && copy.isActive).length,
    restoresVariables: countOf("restores-variables"),
    holdsName: countOf("holds-name"),
    kept: countOf("keep"),
    unreadable: countOf("unreadable")
  };
}
