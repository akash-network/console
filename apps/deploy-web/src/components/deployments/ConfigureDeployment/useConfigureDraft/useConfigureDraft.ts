import { useMemo } from "react";

/** Namespace for persisted configure drafts. Kept distinct from the wallet-scoped keys so it is unaffected by a wallet wipe. */
const DRAFT_KEY_PREFIX = "configure-draft:";

/** Upper bound on retained drafts. On save, the least-recently-updated drafts beyond this are evicted so abandoned sessions can't grow storage unbounded. */
const MAX_DRAFTS = 20;

export const DEPENDENCIES = {
  getStorage: (): Storage | undefined => (typeof window === "undefined" ? undefined : window.localStorage)
};

interface StoredDraft {
  sdl: string;
  updatedAt: number;
}

export interface ConfigureDraft {
  /** The persisted SDL for this draft, or undefined when none exists — a fresh session, an evicted draft, or a link opened in another browser. */
  read(): string | undefined;
  /** Persists `sdl` as the working draft, then evicts the oldest drafts past the cap. */
  save(sdl: string): void;
  /** Removes the persisted draft. */
  clear(): void;
}

/**
 * Reads and writes a single configure draft in local storage, keyed by `draftId`. A configure session mints an id
 * once and carries it in the URL, so a reload restores the working SDL instead of re-seeding from the template. With
 * no id (or no storage, e.g. during SSR) every operation is a safe no-op, which is also how a fresh session behaves.
 */
export function useConfigureDraft(draftId: string | undefined, dependencies: typeof DEPENDENCIES = DEPENDENCIES): ConfigureDraft {
  return useMemo(
    function createDraft() {
      const storage = dependencies.getStorage();
      return {
        read: () => readDraft(storage, draftId),
        save: (sdl: string) => saveDraft(storage, draftId, sdl),
        clear: () => clearDraft(storage, draftId)
      };
    },
    [draftId, dependencies]
  );
}

function keyOf(draftId: string): string {
  return `${DRAFT_KEY_PREFIX}${draftId}`;
}

function readDraft(storage: Storage | undefined, draftId: string | undefined): string | undefined {
  if (!storage || !draftId) {
    return undefined;
  }
  const raw = storage.getItem(keyOf(draftId));
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    return typeof parsed?.sdl === "string" ? parsed.sdl : undefined;
  } catch {
    return undefined;
  }
}

function saveDraft(storage: Storage | undefined, draftId: string | undefined, sdl: string): void {
  if (!storage || !draftId) {
    return;
  }
  const entry: StoredDraft = { sdl, updatedAt: Date.now() };
  storage.setItem(keyOf(draftId), JSON.stringify(entry));
  evictStaleDrafts(storage);
}

function clearDraft(storage: Storage | undefined, draftId: string | undefined): void {
  if (!storage || !draftId) {
    return;
  }
  storage.removeItem(keyOf(draftId));
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
