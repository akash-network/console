import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface StoredRefusal {
  userId: string;
  paymentMethodId?: string;
  refusedAt: number;
}

export interface PaymentRefusals {
  countFor(paymentMethodId: string): number;
  /** Returns how often the payment method has now been refused; a new card the bank refused before it was saved has no id. */
  record(paymentMethodId?: string): number;
  clear(): void;
  /** When the user may pay again, or null while payments are not paused. */
  pausedUntil: number | null;
}

/** Refusals persist per tab, so closing and reopening Add credits (which unmounts the form) does not forget them. */
const REFUSALS_STORAGE_KEY = "add-credits-refusals";

/** Card testing runs dozens of refused payments within minutes, while a customer sorting out a card rarely needs more than a few tries. */
export const MAX_REFUSALS_PER_WINDOW = 5;

export const REFUSAL_WINDOW_MS = 30 * 60 * 1000;

/** Remembers the payments the bank or Stripe refused in this browser session, and pauses payments once too many are refused in a short time. */
export function usePaymentRefusals(userId: string | undefined): PaymentRefusals {
  const [refusals, setRefusals] = useState(readStoredRefusals);
  const refusalsRef = useRef(refusals);
  const [now, setNow] = useState(Date.now);

  const ownRefusals = useMemo(() => refusals.filter(refusal => refusal.userId === userId), [refusals, userId]);
  const pausedUntil = useMemo(() => findPauseEnd(ownRefusals, now), [ownRefusals, now]);

  const storeRefusals = useCallback((next: StoredRefusal[]) => {
    refusalsRef.current = next;
    writeStoredRefusals(next);
    setRefusals(next);
    setNow(Date.now());
  }, []);

  const countFor = useCallback((paymentMethodId: string) => ownRefusals.filter(refusal => refusal.paymentMethodId === paymentMethodId).length, [ownRefusals]);

  const record = useCallback(
    (paymentMethodId?: string) => {
      if (!userId) return 0;
      const next = [...refusalsRef.current, { userId, paymentMethodId, refusedAt: Date.now() }];
      storeRefusals(next);
      return next.filter(refusal => refusal.userId === userId && refusal.paymentMethodId === paymentMethodId).length;
    },
    [userId, storeRefusals]
  );

  const clear = useCallback(() => {
    storeRefusals(refusalsRef.current.filter(refusal => refusal.userId !== userId));
  }, [userId, storeRefusals]);

  useEffect(
    function resumeOnceThePauseEnds() {
      if (pausedUntil === null) return;
      const timeout = setTimeout(() => setNow(Math.max(Date.now(), pausedUntil)), pausedUntil - Date.now());
      return () => clearTimeout(timeout);
    },
    [pausedUntil]
  );

  return useMemo(() => ({ countFor, record, clear, pausedUntil }), [countFor, record, clear, pausedUntil]);
}

function findPauseEnd(refusals: StoredRefusal[], now: number): number | null {
  const recentRefusals = refusals.filter(refusal => now - refusal.refusedAt < REFUSAL_WINDOW_MS).sort((a, b) => a.refusedAt - b.refusedAt);
  if (recentRefusals.length < MAX_REFUSALS_PER_WINDOW) return null;
  return recentRefusals[recentRefusals.length - MAX_REFUSALS_PER_WINDOW].refusedAt + REFUSAL_WINDOW_MS;
}

/** sessionStorage access throws in some privacy modes; remembering refusals is best-effort and must never break the purchase flow. */
function safeSessionStorage<T>(operation: () => T): T | undefined {
  try {
    return operation();
  } catch {
    return undefined;
  }
}

function readStoredRefusals(): StoredRefusal[] {
  const stored = safeSessionStorage(() => JSON.parse(window.sessionStorage.getItem(REFUSALS_STORAGE_KEY) ?? "[]"));
  return Array.isArray(stored) ? stored : [];
}

function writeStoredRefusals(refusals: StoredRefusal[]): void {
  safeSessionStorage(() => window.sessionStorage.setItem(REFUSALS_STORAGE_KEY, JSON.stringify(refusals)));
}
