import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

/** Where drafts lived before they moved to the account, read only so a session started before then can be picked up again. */
export const LEGACY_DRAFT_KEY_PREFIX = "configure-draft:";

/** Lets typing settle before the draft is sent, since every save carries the whole SDL. */
export const SAVE_DELAY_MS = 1000;

export const DEPENDENCIES = {
  // eslint-disable-next-line akash/dependencies-component-or-hook
  getStorage: (): Storage | undefined => {
    if (typeof window === "undefined") {
      return undefined;
    }
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  },
  useRouter,
  useServices,
  useQueryClient,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  mintDraftId
};

/** The regions of each placement that picks several, by placement name, since the SDL can only carry a single one. */
export type PlacementRegionPicks = Record<string, string[]>;

export interface ConfigureDraftContent {
  sdl: string;
  name?: string;
  runtimeLimitHours?: number;
  /** The deployment a redeploy started from, whose stored secret values the create may inherit. */
  inheritSecretsFrom?: string;
  /** The SDL the session started from (a template, an upload or a redeploy), which a reset restores. */
  startingSdl?: string;
  placementRegions?: PlacementRegionPicks;
}

export interface CreateConfigureDraftOptions {
  name?: string;
  inheritSecretsFrom?: string;
}

export interface ConfigureDraft {
  /** The active draft id: the URL's id when resuming a session, otherwise a freshly minted one pinned for this mount. */
  draftId: string;
  /** True while the account's copy of a resumed draft is still being read, when nothing about the draft is known yet. */
  isLoading: boolean;
  /** The persisted SDL for the active draft, or undefined when none exists: a fresh session, an expired draft, or another account's link. */
  persistedSdl: string | undefined;
  /** The persisted deployment name for the active draft, or undefined when none was saved. */
  persistedName: string | undefined;
  /** The persisted runtime limit in hours, or undefined when none was saved. */
  persistedRuntimeLimitHours: number | undefined;
  /** The deployment whose stored secrets this draft inherits, or undefined when it was not started by a redeploy. */
  persistedInheritSecretsFrom: string | undefined;
  /** The SDL the draft's session started from, or undefined when it started from a default deployment. */
  persistedStartingSdl: string | undefined;
  /** The persisted picks of placements choosing several regions, or undefined when none were saved. */
  persistedPlacementRegions: PlacementRegionPicks | undefined;
  /** Saves `sdl` (and the optional deployment `name`, `runtimeLimitHours`, `startingSdl` and `placementRegions`) as the working draft once typing settles. */
  save(sdl: string, name?: string, runtimeLimitHours?: number, startingSdl?: string, placementRegions?: PlacementRegionPicks): void;
  /** Forgets the deployment this draft inherits secrets from, once the console has said those secrets cannot be reused. */
  dropInheritance(): void;
  /** Discards the draft, along with any save still waiting to be sent. */
  clear(): void;
}

/** Drafts started outside the screen wait here for it, since the account only learns of a draft from the screen's first save. */
const handedOverDrafts = new Map<string, ConfigureDraftContent>();

/**
 * Owns the configure screen's draft session, which the account keeps. Resolves the active draft id from the intent: it
 * reuses the id already in the URL when resuming, otherwise mints one and writes it back into the URL (shallow) so a
 * reload restores the same working SDL instead of re-seeding from the template. A draft the account cannot be asked
 * about is left alone and the session continues under a new id, so the old one is never overwritten with a fresh start.
 * Callers given an intent that already carries a draft id get a plain read/save handle: nothing is minted and the URL
 * is left untouched.
 */
export function useConfigureDraft(intent: DeploymentIntent, dependencies: typeof DEPENDENCIES = DEPENDENCIES): ConfigureDraft {
  const router = dependencies.useRouter();
  const { api } = dependencies.useServices();
  const queryClient = dependencies.useQueryClient();
  const storage = useMemo(() => dependencies.getStorage(), [dependencies]);
  /** Read once per mount, so the screen keeps what it was handed even after its first save lets the account take over. */
  const [handedOver] = useState(() => (intent.draftId ? handedOverDrafts.get(intent.draftId) : undefined));

  const accountDraft = api.v1.getConfigureDraft.useQuery(
    { draftId: intent.draftId ?? "" },
    {
      enabled: !!intent.draftId && !handedOver,
      catchError: answerMissingDraftAsNone,
      select: response => response?.data ?? null,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      meta: SKIP_REPORTING_BELOW_SERVER_ERROR
    }
  );

  const recordNoAccountDraft = useCallback(
    (id: string) => queryClient.setQueryData(api.v1.getConfigureDraft.getKey({ draftId: id }), null),
    [queryClient, api]
  );

  /** Records the minted id as having nothing on the account at once, since the form below asks about it before this screen's effects run. */
  const mintFreshDraftId = () => {
    const freshDraftId = dependencies.mintDraftId();
    recordNoAccountDraft(freshDraftId);
    return freshDraftId;
  };

  const mintedDraftIdRef = useRef<string>();
  const draftId = intent.draftId && !accountDraft.isError ? intent.draftId : (mintedDraftIdRef.current ??= mintFreshDraftId());
  const legacyDraft = useMemo(() => (accountDraft.data === null ? readLegacyDraft(storage, draftId) : undefined), [accountDraft.data, storage, draftId]);
  const stored = handedOver ?? accountDraft.data ?? legacyDraft;
  const isLoading = !!intent.draftId && !handedOver && accountDraft.isPending;

  const persistedToUrlRef = useRef<string>();
  useEffect(
    function persistMintedDraftIdInUrl() {
      if (isLoading || draftId === intent.draftId || persistedToUrlRef.current === draftId) {
        return;
      }
      persistedToUrlRef.current = draftId;
      router.replace(buildConfigureUrl({ ...intent, draftId }, intent.dseq, intent.bidStrategy), undefined, { shallow: true });
    },
    [intent, draftId, isLoading, router]
  );

  const draftChanges = useMemo(() => ({ id: `configure-draft:${draftId}` }), [draftId]);
  /** Takes the answer in the mutation's own callback, which still runs when the screen that sent it is gone by then. */
  const { mutate: sendDraft } = api.v1.updateConfigureDraft.useMutation({
    scope: draftChanges,
    meta: SKIP_REPORTING_BELOW_SERVER_ERROR,
    onSuccess: (response, { draftId: savedDraftId }) => {
      queryClient.setQueryData(api.v1.getConfigureDraft.getKey({ draftId: savedDraftId }), response);
      handedOverDrafts.delete(savedDraftId);
      forgetLegacyDraft(storage, savedDraftId);
    }
  });
  const { mutate: discardDraft } = api.v1.deleteConfigureDraft.useMutation({
    scope: draftChanges,
    meta: SKIP_REPORTING_BELOW_SERVER_ERROR,
    onSuccess: (_response, { draftId: discardedDraftId }) => recordNoAccountDraft(discardedDraftId)
  });

  const pendingSaveRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<ConfigureDraftContent>();
  const latestContentRef = useRef<ConfigureDraftContent>();
  const lastSentRef = useRef<string>();
  const isClearedRef = useRef(false);
  const isInheritanceDroppedRef = useRef(false);
  const inheritSecretsFrom = stored?.inheritSecretsFrom;

  const sendNow = useCallback(
    (content: ConfigureDraftContent) => {
      clearTimeout(pendingSaveRef.current);
      pendingContentRef.current = undefined;
      const body = JSON.stringify(content);
      if (isClearedRef.current || body === lastSentRef.current) return;

      lastSentRef.current = body;
      sendDraft({ draftId, data: content }, { onError: () => (lastSentRef.current = undefined) });
    },
    [draftId, sendDraft]
  );

  const save = useCallback(
    (sdl: string, name?: string, runtimeLimitHours?: number, startingSdl?: string, placementRegions?: PlacementRegionPicks) => {
      const content: ConfigureDraftContent = {
        sdl,
        name,
        runtimeLimitHours,
        startingSdl,
        placementRegions,
        inheritSecretsFrom: isInheritanceDroppedRef.current ? undefined : inheritSecretsFrom
      };
      clearTimeout(pendingSaveRef.current);
      pendingContentRef.current = content;
      latestContentRef.current = content;
      pendingSaveRef.current = setTimeout(() => sendNow(content), SAVE_DELAY_MS);
    },
    [inheritSecretsFrom, sendNow]
  );

  useEffect(
    function sendWhatIsStillWaitingOnLeave() {
      return function flushPendingSave() {
        if (pendingContentRef.current) sendNow(pendingContentRef.current);
      };
    },
    [sendNow]
  );

  const dropInheritance = useCallback(() => {
    isInheritanceDroppedRef.current = true;
    const latest = latestContentRef.current ?? stored;
    if (latest) sendNow({ ...latest, inheritSecretsFrom: undefined });
  }, [sendNow, stored]);

  const clear = useCallback(() => {
    clearTimeout(pendingSaveRef.current);
    pendingContentRef.current = undefined;
    isClearedRef.current = true;
    handedOverDrafts.delete(draftId);
    forgetLegacyDraft(storage, draftId);
    discardDraft({ draftId });
  }, [draftId, storage, discardDraft]);

  return useMemo<ConfigureDraft>(
    () => ({
      draftId,
      isLoading,
      persistedSdl: stored?.sdl,
      persistedName: stored?.name,
      persistedRuntimeLimitHours: stored?.runtimeLimitHours,
      persistedInheritSecretsFrom: inheritSecretsFrom,
      persistedStartingSdl: stored?.startingSdl,
      persistedPlacementRegions: stored?.placementRegions,
      save,
      dropInheritance,
      clear
    }),
    [draftId, isLoading, stored, inheritSecretsFrom, save, dropInheritance, clear]
  );
}

/**
 * Starts a configure session from an SDL produced outside the screen (e.g. an uploaded file or a redeploy): mints a
 * draft id, hands the SDL (and the optional deployment `name` and `inheritSecretsFrom`) over under it, both as the
 * working SDL and as the one a reset restores, and returns the id so the caller can route to `configure?draftId=<id>`.
 */
export function createConfigureDraft(sdl: string, options: CreateConfigureDraftOptions = {}, dependencies: typeof DEPENDENCIES = DEPENDENCIES): string {
  const draftId = dependencies.mintDraftId();
  handedOverDrafts.set(draftId, { sdl, name: options.name, inheritSecretsFrom: options.inheritSecretsFrom, startingSdl: sdl });
  return draftId;
}

/** Mints the id that keys a configure session's draft. */
function mintDraftId(): string {
  return nanoid();
}

/** A draft the account does not have is a fresh session, while any other refusal leaves the draft unknown. */
function answerMissingDraftAsNone(error: Error): null {
  if (error instanceof ApiError && error.status === 404) return null;
  throw error;
}

function legacyKeyOf(draftId: string): string {
  return `${LEGACY_DRAFT_KEY_PREFIX}${draftId}`;
}

function readLegacyDraft(storage: Storage | undefined, draftId: string): ConfigureDraftContent | undefined {
  try {
    const raw = storage?.getItem(legacyKeyOf(draftId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown> | null) : undefined;
    if (!parsed || typeof parsed.sdl !== "string") return undefined;

    return {
      sdl: parsed.sdl,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      runtimeLimitHours: typeof parsed.runtimeLimitHours === "number" ? parsed.runtimeLimitHours : undefined,
      inheritSecretsFrom: typeof parsed.inheritSecretsFrom === "string" ? parsed.inheritSecretsFrom : undefined,
      startingSdl: typeof parsed.startingSdl === "string" ? parsed.startingSdl : undefined,
      placementRegions: isPlacementRegionPicks(parsed.placementRegions) ? parsed.placementRegions : undefined
    };
  } catch {
    return undefined;
  }
}

function isPlacementRegionPicks(value: unknown): value is PlacementRegionPicks {
  return typeof value === "object" && value !== null && Object.values(value).every(regions => Array.isArray(regions));
}

function forgetLegacyDraft(storage: Storage | undefined, draftId: string): void {
  try {
    storage?.removeItem(legacyKeyOf(draftId));
  } catch {
    return;
  }
}
