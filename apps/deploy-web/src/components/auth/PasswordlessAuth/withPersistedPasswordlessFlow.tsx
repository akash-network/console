"use client";

import type { ComponentType } from "react";
import { useCallback, useState } from "react";

/** sessionStorage key for the in-flight passwordless email. Per-tab; cleared on successful verify. The screen itself lives in the URL. */
export const EMAIL_CODE_FLOW_STORAGE_KEY = "console_email_code_flow_v1";

/** sessionStorage key for the last code-send time (ms), so the resend cooldown survives a reload. Per-tab. */
export const CODE_SENT_AT_STORAGE_KEY = "console_email_code_sent_at_v1";

/** Record that a code was just sent, anchoring the resend cooldown so a page reload continues it instead of restarting. */
export function markCodeSent(): void {
  try {
    window.sessionStorage.setItem(CODE_SENT_AT_STORAGE_KEY, String(Date.now()));
  } catch {
    return;
  }
}

/** Epoch ms of the last code send; null when unknown (missing, corrupted, or server-side). */
export function readCodeSentAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CODE_SENT_AT_STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface PassedFlowProps {
  initialEmail: string;
  onEmailChange: (email: string) => void;
  onFlowReset: () => void;
}

/**
 * Lifts sessionStorage hydration and persistence of the in-flight email out of the wrapped component.
 * Read happens in a lazy useState initializer so the first paint already reflects the persisted email.
 * Intended to be combined with `dynamic({ ssr: false })` at the route entry to avoid SSR hydration mismatch.
 */
export function withPersistedPasswordlessFlow<P extends PassedFlowProps>(Component: ComponentType<P>): ComponentType<Omit<P, keyof PassedFlowProps>> {
  function WithPersistedPasswordlessFlow(outerProps: Omit<P, keyof PassedFlowProps>) {
    const [initialEmail] = useState(readPersistedEmail);

    const persistPasswordlessEmail = useCallback((email: string) => {
      try {
        if (!email) {
          window.sessionStorage.removeItem(EMAIL_CODE_FLOW_STORAGE_KEY);
          return;
        }
        window.sessionStorage.setItem(EMAIL_CODE_FLOW_STORAGE_KEY, JSON.stringify({ email }));
      } catch {
        return;
      }
    }, []);

    const clearPersistedPasswordlessFlow = useCallback(() => {
      try {
        window.sessionStorage.removeItem(EMAIL_CODE_FLOW_STORAGE_KEY);
        window.sessionStorage.removeItem(CODE_SENT_AT_STORAGE_KEY);
      } catch {
        return;
      }
    }, []);

    return (
      <Component {...(outerProps as P)} initialEmail={initialEmail} onEmailChange={persistPasswordlessEmail} onFlowReset={clearPersistedPasswordlessFlow} />
    );
  }
  WithPersistedPasswordlessFlow.displayName = `withPersistedPasswordlessFlow(${Component.displayName ?? Component.name ?? "Component"})`;
  return WithPersistedPasswordlessFlow;
}

/** The persisted email; "" when unknown (missing, corrupted, or server-side). */
function readPersistedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { email?: unknown };
    return typeof parsed.email === "string" ? parsed.email : "";
  } catch {
    return "";
  }
}
