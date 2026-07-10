import { useEffect, useMemo, useRef } from "react";
import { nanoid } from "nanoid";
import { useRouter } from "next/router";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

/** Namespace for persisted configure drafts. Kept distinct from the wallet-scoped keys so it is unaffected by a wallet wipe. */
const DRAFT_KEY_PREFIX = "configure-draft:";

/** Upper bound on retained drafts. On save, the least-recently-updated drafts beyond this are evicted so abandoned sessions can't grow storage unbounded. */
const MAX_DRAFTS = 20;

export const DEPENDENCIES = {
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
  mintDraftId
};

interface StoredDraft {
  sdl: string;
  name?: string;
  updatedAt: number;
}

export interface ConfigureDraft {
  /** The active draft id: the URL's id when resuming a session, otherwise a freshly minted one pinned for this mount. */
  draftId: string;
  /** The persisted SDL for the active draft, or undefined when none exists — a fresh session, an evicted draft, or a link opened in another browser. */
  persistedSdl: string | undefined;
  /** The persisted deployment name for the active draft, or undefined when none was saved. */
  persistedName: string | undefined;
  /** Persists `sdl` (and the optional deployment `name`) as the working draft, then evicts the oldest drafts past the cap. */
  save(sdl: string, name?: string): void;
  /** Removes the persisted draft. */
  clear(): void;
}

/**
 * Owns the configure screen's draft session. Resolves the active draft id from the intent: it reuses the id already in
 * the URL when resuming, otherwise mints one and writes it back into the URL (shallow) so a reload restores the same
 * working SDL instead of re-seeding from the template. It reads the persisted SDL for that id and exposes save/clear
 * bound to it. With no storage (SSR, or a blocked/full bucket) reads yield undefined and writes are safe no-ops, which
 * is also how a fresh session behaves. Callers given an intent that already carries a draft id (e.g. once the screen has
 * resolved it) get a plain read/save handle: nothing is minted and the URL is left untouched.
 */
export function useConfigureDraft(intent: DeploymentIntent, dependencies: typeof DEPENDENCIES = DEPENDENCIES): ConfigureDraft {
  const router = dependencies.useRouter();
  const storage = useMemo(() => dependencies.getStorage(), [dependencies]);

  const mintedDraftIdRef = useRef<string>();
  const draftId = intent.draftId ?? (mintedDraftIdRef.current ??= dependencies.mintDraftId());

  const storedDraft = useMemo(() => readStoredDraft(storage, draftId), [storage, draftId]);
  const persistedSdl = typeof storedDraft?.sdl === "string" ? storedDraft.sdl : undefined;
  const persistedName = typeof storedDraft?.name === "string" ? storedDraft.name : undefined;

  const persistedToUrlRef = useRef<string>();
  useEffect(
    function persistDraftIdInUrl() {
      if (intent.draftId || persistedToUrlRef.current === draftId) {
        return;
      }
      persistedToUrlRef.current = draftId;
      router.replace(buildConfigureUrl({ ...intent, draftId }, intent.dseq, intent.bidStrategy), undefined, { shallow: true });
    },
    [intent, draftId, router]
  );

  return useMemo<ConfigureDraft>(
    () => ({
      draftId,
      persistedSdl,
      persistedName,
      save: (sdl: string, name?: string) => saveDraft(storage, draftId, sdl, name),
      clear: () => clearDraft(storage, draftId)
    }),
    [draftId, persistedSdl, persistedName, storage]
  );
}

/**
 * Starts a configure session from an SDL produced outside the screen (e.g. an uploaded file): mints a draft id,
 * persists the SDL under it, and returns the id so the caller can route to `configure?draftId=<id>`. Uses the same
 * storage format as in-screen saves, so the configure screen restores it via `persistedSdl` on arrival. Storage-safe:
 * if storage is blocked or full the write no-ops and the id is still returned (configure then seeds from its other
 * sources), matching how `saveDraft` already swallows failures.
 */
export function createConfigureDraft(sdl: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): string {
  const draftId = dependencies.mintDraftId();
  saveDraft(dependencies.getStorage(), draftId, sdl);
  return draftId;
}

/** Mints the id that keys a configure session's persisted draft. */
function mintDraftId(): string {
  return nanoid();
}

function keyOf(draftId: string): string {
  return `${DRAFT_KEY_PREFIX}${draftId}`;
}

/** Reads and parses the stored draft once; callers pluck `sdl`/`name` so a render reads and parses storage a single time. */
function readStoredDraft(storage: Storage | undefined, draftId: string | undefined): StoredDraft | undefined {
  if (!storage || !draftId) {
    return undefined;
  }
  try {
    const raw = storage.getItem(keyOf(draftId));
    return raw ? (JSON.parse(raw) as StoredDraft) : undefined;
  } catch {
    return undefined;
  }
}

function saveDraft(storage: Storage | undefined, draftId: string | undefined, sdl: string, name?: string): void {
  if (!storage || !draftId) {
    return;
  }
  try {
    const entry: StoredDraft = { sdl, name, updatedAt: Date.now() };
    storage.setItem(keyOf(draftId), JSON.stringify(entry));
    evictStaleDrafts(storage);
  } catch {
    return;
  }
}

function clearDraft(storage: Storage | undefined, draftId: string | undefined): void {
  if (!storage || !draftId) {
    return;
  }
  try {
    storage.removeItem(keyOf(draftId));
  } catch {
    return;
  }
}

/** Caps retained drafts at `MAX_DRAFTS`, dropping the least-recently-updated entries first. */
function evictStaleDrafts(storage: Storage): void {
  const entries = Object.keys(storage)
    .filter(key => key.startsWith(DRAFT_KEY_PREFIX))
    .map(key => ({ key, updatedAt: parseUpdatedAt(storage.getItem(key)) }));
  if (entries.length <= MAX_DRAFTS) {
    return;
  }
  entries
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(MAX_DRAFTS)
    .forEach(entry => storage.removeItem(entry.key));
}

/** Recovers a draft's recency for eviction ordering, treating unreadable entries as oldest. */
function parseUpdatedAt(raw: string | null): number {
  if (!raw) {
    return 0;
  }
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    return typeof parsed?.updatedAt === "number" ? parsed.updatedAt : 0;
  } catch {
    return 0;
  }
}
