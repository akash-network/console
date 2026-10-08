"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { catchDeploymentReadError, manifestVersionOrNull } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { backfilledNameOf } from "@src/hooks/useDeploymentNameBackfill/useDeploymentNameBackfill";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import { isBrowserRestoreOffered } from "@src/utils/sdl/browserRestoreDeadline";
import { importableServicesOf, recordableDefinitionOf, referenceNamesOf } from "@src/utils/sdl/recordableDefinition";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import type { DefinitionSealing } from "@src/utils/sdl/sendSealedDefinition";
import { isDefinitionAlreadyRecorded, sendSealedDefinition } from "@src/utils/sdl/sendSealedDefinition";
import type { DeploymentCopy, DeploymentCopyFate, DeploymentRecord } from "./deploymentCopyFate";
import { deploymentCopyFateOf } from "./deploymentCopyFate";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useQueryClient,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  now: () => new Date()
};

type Recording = "recorded" | "failed";

interface CheckedCopy {
  fate: DeploymentCopyFate | "unreadable";
  isActive: boolean;
  recording?: Recording;
  isNameSent: boolean;
}

/** A copy that can't be read or judged is kept and counted, so one bad entry doesn't stop the copies after it from being checked. */
const UNREADABLE_COPY: CheckedCopy = { fate: "unreadable", isActive: false, isNameSent: false };

/** Recorded as this browser kept it: variables stay readable, and only the registry credentials are sealed, as in every definition. */
const NO_CHOSEN_SECRETS = { secretVariables: new Set<string>(), referenceValues: new Map<string, string>() };

interface CopyAccess {
  recordOf: (dseq: string) => Promise<DeploymentRecord | null>;
  copyOf: (dseq: string) => DeploymentCopy;
  fateOf: (copy: DeploymentCopy, record: DeploymentRecord | null) => Promise<DeploymentCopyFate>;
  recordDefinition: (dseq: string, sdl: string) => Promise<void>;
  sendName: (dseq: string, name: string) => Promise<boolean>;
  forget: (dseq: string) => void;
}

/** Hands the console what this browser's copies of older deployments' configuration still hold, forgets each copy nothing else needs, and reports what is left. */
export function DeploymentCopyCleanup({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}) {
  const { address } = d.useWallet();
  const { api, deploymentLocalStorage, deploymentNameBackfill, analyticsService } = d.useServices();
  const queryClient = d.useQueryClient();
  const { mutateAsync: getSealingContext } = api.v1.getSDLSecretsContext.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { mutateAsync: createDefinition } = api.v1.createDeploymentDefinition.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { mutateAsync: patchDeployment } = api.v1.patchDeployment.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { sealSdlSecrets: seal, now } = d;
  const checkedAddresses = useRef(new Set<string>());

  useEffect(
    function retireCopiesTheConsoleCanReplace() {
      if (!address || checkedAddresses.current.has(address)) return;
      checkedAddresses.current.add(address);

      const dseqs = deploymentLocalStorage.dseqsOf(address);
      if (dseqs.length === 0) return;

      const judging = { manifestVersionOf: manifestVersionOrNull, isBrowserRestoreOffered: isBrowserRestoreOffered(now()) };
      const sealing: DefinitionSealing = { contextOf: async () => (await getSealingContext()).data, seal };
      const copies: CopyAccess = {
        recordOf: dseq =>
          queryClient.fetchQuery({ ...api.v1.getDeployment.queryOptions({ dseq }, { catchError: catchDeploymentReadError }), staleTime: 0 }).then(
            response => response?.data ?? null,
            () => null
          ),
        copyOf: dseq => deploymentLocalStorage.get(address, dseq) ?? {},
        fateOf: (copy, record) => deploymentCopyFateOf(copy, record, judging),
        recordDefinition: async (dseq, sdl) => {
          const definition = recordableDefinitionOf(sdl, NO_CHOSEN_SECRETS);
          await sendSealedDefinition(definition, sealing, sealedSecrets => createDefinition({ dseq, data: { sdl: definition.sdl, sealedSecrets } }));
        },
        sendName: (dseq, name) => deploymentNameBackfill.enqueue(address, dseq, () => patchDeployment({ dseq, data: { name } })),
        forget: dseq => deploymentLocalStorage.delete(address, dseq)
      };

      void checkCopiesOneAtATime(dseqs, copies).then(checked =>
        analyticsService.track("deployment_copies_checked", { category: "deployments", ...countsOf(checked) })
      );
    },
    [
      address,
      api,
      deploymentLocalStorage,
      deploymentNameBackfill,
      analyticsService,
      queryClient,
      getSealingContext,
      createDefinition,
      patchDeployment,
      seal,
      now
    ]
  );

  return null;
}

/** One at a time, so a browser holding many copies does not fire a burst of requests at the api on load. */
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
  const isActive = record?.deployment.state === "active";
  const fate = await copies.fateOf(copy, record);
  const recorded = await recordRunningCopyOnlyHere(dseq, copy, { fate, isActive }, copies);
  const named = await sendHeldName(dseq, copy, recorded.fate, copies);

  if (named.fate === "forget") copies.forget(dseq);
  return { fate: named.fate, isActive, recording: recorded.recording, isNameSent: named.isNameSent };
}

/** A closed deployment's copy is left as it is, and a copy referring to a secret this browser has no value for cannot be recorded. */
async function recordRunningCopyOnlyHere(
  dseq: string,
  copy: DeploymentCopy,
  { fate, isActive }: { fate: DeploymentCopyFate; isActive: boolean },
  copies: CopyAccess
): Promise<{ fate: DeploymentCopyFate; recording?: Recording }> {
  if (fate !== "only-in-browser" || !isActive || !copy.manifest || refersToMissingSecrets(copy.manifest)) return { fate };

  const isRecorded = await copies.recordDefinition(dseq, copy.manifest).then(() => true, isDefinitionAlreadyRecorded);
  if (!isRecorded) return { fate, recording: "failed" };

  return { fate: await rejudged(dseq, copy, copies), recording: "recorded" };
}

async function sendHeldName(
  dseq: string,
  copy: DeploymentCopy,
  fate: DeploymentCopyFate,
  copies: CopyAccess
): Promise<{ fate: DeploymentCopyFate; isNameSent: boolean }> {
  const name = backfilledNameOf(copy.name);
  if (fate !== "holds-name" || !name) return { fate, isNameSent: false };

  const isNameSent = await copies.sendName(dseq, name);
  if (!isNameSent) return { fate, isNameSent };

  return { fate: await rejudged(dseq, copy, copies), isNameSent };
}

async function rejudged(dseq: string, copy: DeploymentCopy, copies: CopyAccess): Promise<DeploymentCopyFate> {
  return copies.fateOf(copy, await copies.recordOf(dseq));
}

function refersToMissingSecrets(sdl: string): boolean {
  return referenceNamesOf(importableServicesOf(sdl)).length > 0;
}

function countsOf(checked: CheckedCopy[]) {
  const countOf = (fate: CheckedCopy["fate"]) => checked.filter(copy => copy.fate === fate).length;
  const countRecording = (recording: Recording) => checked.filter(copy => copy.recording === recording).length;

  return {
    copies: checked.length,
    forgotten: countOf("forget"),
    onlyInBrowser: countOf("only-in-browser"),
    onlyInBrowserActive: checked.filter(copy => copy.fate === "only-in-browser" && copy.isActive).length,
    restoresVariables: countOf("restores-variables"),
    holdsName: countOf("holds-name"),
    kept: countOf("keep"),
    unreadable: countOf("unreadable"),
    recorded: countRecording("recorded"),
    recordFailed: countRecording("failed"),
    namesSent: checked.filter(copy => copy.isNameSent).length
  };
}
