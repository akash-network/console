import { useCallback, useMemo, useRef } from "react";

interface StoredAttempt {
  key: string;
  amountCents: number;
  paymentMethodId: string;
  userId: string;
  createdAt: number;
  walletType?: string;
}

export interface ResolveAttemptInput {
  userId: string;
  amount: number;
  paymentMethodId: string;
  walletType?: string;
}

export interface TopUpAttemptKey {
  /**
   * Reuses the in-memory key while the purchase params are unchanged (a retry of the same attempt),
   * rehydrates a matching persisted key after a remount, and only otherwise mints a fresh one.
   */
  resolve(input: ResolveAttemptInput): string;
  /** Forgets the current attempt once it has concluded (polling confirmed settlement) so the next purchase mints a fresh key. */
  clear(): void;
  /** Forgets the attempt only when the error proves it is dead, so a retry after an unknown-outcome failure replays the same key. */
  clearIfConcluded(error: unknown): void;
  getWalletAttempt(input: { userId: string; amount: number }): { paymentMethodId: string; type: string } | null;
}

/** Attempt keys persist per tab so closing and reopening the errored sheet (which unmounts the form) retries the same attempt instead of minting a fresh charge. */
const ATTEMPT_STORAGE_KEY = "add-credits-attempt";

/** A stored attempt older than this is treated as a new purchase, not a retry. It matches Stripe's 24h replay window: expiring sooner would mint a fresh key (and possibly a duplicate charge) while the original attempt could still settle. */
const ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Owns the replay-safe idempotency key for a single top-up charge attempt. The key survives
 * unknown-outcome failures (and remounts, via sessionStorage) and rotates only when the attempt
 * concludes (polling confirmed settlement, a definitive 402 decline, or a 409 key mismatch) or its
 * params change, so a retried slow charge replays the original attempt instead of charging again.
 */
export function useTopUpAttemptKey(): TopUpAttemptKey {
  const attemptRef = useRef<(ResolveAttemptInput & { key: string; createdAt: number }) | null>(null);

  const resolve = useCallback(({ userId, amount, paymentMethodId, walletType }: ResolveAttemptInput): string => {
    const amountCents = Math.round(amount * 100);
    const current = attemptRef.current;

    if (current && current.userId === userId && current.amount === amount && current.paymentMethodId === paymentMethodId) {
      return current.key;
    }

    const stored = readStoredAttempt({ userId, amountCents, paymentMethodId });

    if (stored) {
      attemptRef.current = { key: stored.key, userId, amount, paymentMethodId, walletType: stored.walletType, createdAt: stored.createdAt };
      return stored.key;
    }

    const key = crypto.randomUUID();
    const createdAt = Date.now();
    attemptRef.current = { key, userId, amount, paymentMethodId, walletType, createdAt };
    writeStoredAttempt({ key, amountCents, paymentMethodId, userId, walletType, createdAt });

    return key;
  }, []);

  const getWalletAttempt = useCallback(({ userId, amount }: { userId: string; amount: number }) => {
    const current = attemptRef.current;
    if (current && current.userId === userId && current.amount === amount && current.walletType && Date.now() - current.createdAt < ATTEMPT_MAX_AGE_MS) {
      return { paymentMethodId: current.paymentMethodId, type: current.walletType };
    }
    const stored = readStoredAttempt({ userId, amountCents: Math.round(amount * 100) });
    return stored?.walletType ? { paymentMethodId: stored.paymentMethodId, type: stored.walletType } : null;
  }, []);

  const clear = useCallback(() => {
    attemptRef.current = null;
    clearStoredAttempt();
  }, []);

  const clearIfConcluded = useCallback(
    (error: unknown) => {
      if (isConcludedError(error)) {
        clear();
      }
    },
    [clear]
  );

  return useMemo(() => ({ resolve, clear, clearIfConcluded, getWalletAttempt }), [resolve, clear, clearIfConcluded, getWalletAttempt]);
}

/** sessionStorage access throws in some privacy modes; attempt-key persistence is best-effort and must never break the purchase flow. */
function safeSessionStorage<T>(operation: () => T): T | undefined {
  try {
    return operation();
  } catch {
    return undefined;
  }
}

function readStoredAttempt(input: { userId: string; amountCents: number; paymentMethodId?: string }): StoredAttempt | null {
  const raw = safeSessionStorage(() => window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY));
  if (!raw) return null;

  const stored = safeSessionStorage(() => JSON.parse(raw) as StoredAttempt);
  if (!stored) return null;

  const isCurrentAttempt =
    stored.userId === input.userId &&
    stored.amountCents === input.amountCents &&
    (input.paymentMethodId === undefined || stored.paymentMethodId === input.paymentMethodId) &&
    Date.now() - stored.createdAt < ATTEMPT_MAX_AGE_MS;

  return isCurrentAttempt ? stored : null;
}

function writeStoredAttempt(attempt: StoredAttempt): void {
  safeSessionStorage(() => window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt)));
}

function clearStoredAttempt(): void {
  safeSessionStorage(() => window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY));
}

/** Two responses prove the attempt is dead: a 402 (the bank definitively declined, and Stripe replays that decline for the key's lifetime) and a 409 idempotency_key_mismatch (the key is permanently bound to different parameters). Retrying either with the same key could never succeed. Every other failure (timeout, 4xx/5xx, no response) leaves the outcome unknown and the key must survive. */
function isConcludedError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("response" in error)) return false;

  const response = (error as { response?: { status?: number; data?: { code?: string } } }).response;

  return response?.status === 402 || (response?.status === 409 && response.data?.code === "idempotency_key_mismatch");
}
