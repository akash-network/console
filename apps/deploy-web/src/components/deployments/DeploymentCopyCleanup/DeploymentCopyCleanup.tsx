"use client";
import { useEffect, useRef } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { manifestVersionOrNull } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import { importableServicesOf, recordableDefinitionOf, referenceNamesOf } from "@src/utils/sdl/recordableDefinition";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import type { DefinitionSealing } from "@src/utils/sdl/sendSealedDefinition";
import { isDefinitionAlreadyRecorded, isDefinitionMismatch, sendSealedDefinition } from "@src/utils/sdl/sendSealedDefinition";
import type { DefinitionFate, DeploymentCopy, DeploymentRecord } from "./deploymentCopyFate";
import { definitionFateOf, unsentNameOf } from "./deploymentCopyFate";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useQueryClient,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets
};

/** Every outcome but `forgotten` and `unreadable` leaves the copy in place for the next visit to check again. */
type Outcome = "forgotten" | "unreadable" | "kept-running" | "record-failed" | "name-failed" | "unchecked";

type Recording = "recorded" | "refused";

interface CheckedCopy {
  outcome: Outcome;
  recording?: Recording;
  isNameSent: boolean;
}

const MISSING = "missing";

/** A check the api did not answer for, or that failed in any other way, keeps its copy without stopping the copies after it. */
const UNCHECKED_COPY: CheckedCopy = { outcome: "unchecked", isNameSent: false };

/** Recorded as this browser kept it: variables stay readable, and only the registry credentials are sealed, as in every definition. */
const NO_CHOSEN_SECRETS = { secretVariables: new Set<string>(), referenceValues: new Map<string, string>() };

interface CopyAccess {
  copyOf: (dseq: string) => DeploymentCopy | null;
  lookUp: (dseq: string) => Promise<DeploymentRecord | typeof MISSING>;
  definitionFateOf: (copy: DeploymentCopy, record: DeploymentRecord) => Promise<DefinitionFate>;
  recordDefinition: (dseq: string, sdl: string) => Promise<void>;
  sendName: (dseq: string, name: string) => Promise<boolean>;
  forget: (dseq: string) => void;
}

/** Removes this browser's copies of older deployments' configuration, handing the console what only a copy still holds first, and reports what is left. */
export function DeploymentCopyCleanup({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}) {
  const { address } = d.useWallet();
  const { api, deploymentLocalStorage, deploymentNameBackfill, analyticsService } = d.useServices();
  const queryClient = d.useQueryClient();
  const { mutateAsync: getSealingContext } = api.v1.getSDLSecretsContext.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { mutateAsync: createDefinition } = api.v1.createDeploymentDefinition.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { mutateAsync: patchDeployment } = api.v1.patchDeployment.useMutation({ meta: SKIP_REPORTING_BELOW_SERVER_ERROR });
  const { sealSdlSecrets: seal } = d;
  const checkedAddresses = useRef(new Set<string>());

  useEffect(
    function forgetCopiesOfOtherNetworks() {
      deploymentLocalStorage.deleteOtherNetworks();
    },
    [deploymentLocalStorage]
  );

  useEffect(
    function retireCopiesOfThisWallet() {
      if (!address || checkedAddresses.current.has(address)) return;
      checkedAddresses.current.add(address);

      const dseqs = deploymentLocalStorage.dseqsOf(address);
      if (dseqs.length === 0) return;

      const sealing: DefinitionSealing = { contextOf: async () => (await getSealingContext()).data, seal };
      const copies: CopyAccess = {
        copyOf: dseq => readableCopyOf(() => deploymentLocalStorage.get(address, dseq)),
        lookUp: dseq =>
          queryClient
            .fetchQuery({
              ...api.v1.getDeployment.queryOptions({ dseq }, { catchError: nullWhenNotFound, meta: SKIP_REPORTING_BELOW_SERVER_ERROR }),
              staleTime: 0
            })
            .then(response => response?.data ?? MISSING),
        definitionFateOf: (copy, record) => definitionFateOf(copy, record, manifestVersionOrNull),
        recordDefinition: async (dseq, sdl) => {
          const definition = recordableDefinitionOf(sdl, NO_CHOSEN_SECRETS);
          await sendSealedDefinition(definition, sealing, sealedSecrets => createDefinition({ dseq, data: { sdl: definition.sdl, sealedSecrets } }));
        },
        sendName: (dseq, name) => deploymentNameBackfill.enqueue(address, dseq, () => patchDeployment({ dseq, data: { name } })),
        forget: dseq => deploymentLocalStorage.delete(address, dseq)
      };

      void checkCopiesOneAtATime(dseqs, copies).then(checked => {
        if (checked.some(copy => copy.recording === "recorded" || copy.isNameSent)) {
          [api.v1.getDeployment, api.v1.listDeploymentNames, api.v1.listDeployments].forEach(query =>
            queryClient.invalidateQueries({ queryKey: query.getKey() })
          );
        }
        analyticsService.track("deployment_copies_checked", { category: "deployments", ...countsOf(checked) });
      });
    },
    [address, api, deploymentLocalStorage, deploymentNameBackfill, analyticsService, queryClient, getSealingContext, createDefinition, patchDeployment, seal]
  );

  return null;
}

/** Only a 404 says the console knows no such deployment for this wallet; any other failure leaves the copy to the next visit. */
function nullWhenNotFound(error: Error): null {
  if (error instanceof ApiError && error.status === 404) return null;
  throw error;
}

function readableCopyOf(read: () => DeploymentCopy | null): DeploymentCopy | null {
  try {
    return read() ?? {};
  } catch {
    return null;
  }
}

/** One at a time, so a browser holding many copies does not fire a burst of requests at the api on load. */
async function checkCopiesOneAtATime(dseqs: string[], copies: CopyAccess): Promise<CheckedCopy[]> {
  const checked: CheckedCopy[] = [];
  for (const dseq of dseqs) {
    checked.push(await checkCopy(dseq, copies).catch(() => UNCHECKED_COPY));
  }
  return checked;
}

async function checkCopy(dseq: string, copies: CopyAccess): Promise<CheckedCopy> {
  const copy = copies.copyOf(dseq);
  if (!copy) return forgotten(dseq, copies, { outcome: "unreadable", isNameSent: false });

  const lookup = await copies.lookUp(dseq);
  if (lookup === MISSING) return forgotten(dseq, copies, { outcome: "forgotten", isNameSent: false });

  const definition = await settleDefinition(dseq, copy, lookup, copies);
  const isNameSent = await sendUnsentName(dseq, copy, lookup, copies);
  const outcome: Outcome = definition.keptAs ?? (isNameSent === false ? "name-failed" : "forgotten");
  const checked: CheckedCopy = { outcome, recording: definition.recording, isNameSent: !!isNameSent };

  return outcome === "forgotten" ? forgotten(dseq, copies, checked) : checked;
}

function forgotten(dseq: string, copies: CopyAccess, checked: CheckedCopy): CheckedCopy {
  copies.forget(dseq);
  return checked;
}

/** A copy referring to a secret this browser holds no value for can't be recorded on its own, so it waits for the user to save it from the update tab. */
async function settleDefinition(
  dseq: string,
  copy: DeploymentCopy,
  record: DeploymentRecord,
  copies: CopyAccess
): Promise<{ keptAs?: "kept-running" | "record-failed"; recording?: Recording }> {
  const fate = await copies.definitionFateOf(copy, record);
  if (fate === "forget" || !copy.manifest) return {};
  if (fate === "keep" || refersToMissingSecrets(copy.manifest)) return { keptAs: "kept-running" };

  const recording = await copies.recordDefinition(dseq, copy.manifest).then(() => "recorded" as const, recordingOutcomeOf);
  return recording === "failed" ? { keptAs: "record-failed" } : { recording };
}

/** A copy the console finds does not match what runs is not the deployment's definition, so it goes; any other refusal is tried again on the next visit. */
function recordingOutcomeOf(error: unknown): Recording | "failed" {
  if (isDefinitionAlreadyRecorded(error)) return "recorded";
  return isDefinitionMismatch(error) ? "refused" : "failed";
}

/** Undefined when the copy holds no name the console lacks. */
async function sendUnsentName(dseq: string, copy: DeploymentCopy, record: DeploymentRecord, copies: CopyAccess): Promise<boolean | undefined> {
  const name = unsentNameOf(copy, record);
  return name ? copies.sendName(dseq, name) : undefined;
}

function refersToMissingSecrets(sdl: string): boolean {
  return referenceNamesOf(importableServicesOf(sdl)).length > 0;
}

function countsOf(checked: CheckedCopy[]) {
  const countOf = (outcome: Outcome) => checked.filter(copy => copy.outcome === outcome).length;
  const countRecording = (recording: Recording) => checked.filter(copy => copy.recording === recording).length;

  return {
    copies: checked.length,
    forgotten: countOf("forgotten") + countOf("unreadable"),
    unreadable: countOf("unreadable"),
    keptRunning: countOf("kept-running"),
    recordFailed: countOf("record-failed"),
    nameFailed: countOf("name-failed"),
    unchecked: countOf("unchecked"),
    recorded: countRecording("recorded"),
    recordRefused: countRecording("refused"),
    namesSent: checked.filter(copy => copy.isNameSent).length
  };
}
