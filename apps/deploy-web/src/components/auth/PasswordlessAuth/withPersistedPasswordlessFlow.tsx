"use client";

import type { ComponentType } from "react";
import { useCallback, useState } from "react";

/** sessionStorage key for the in-flight passwordless screen + email. Per-tab; cleared on successful verify. */
export const EMAIL_CODE_FLOW_STORAGE_KEY = "console_email_code_flow_v1";

export interface PassedFlowProps {
  initialEmail: string;
  initialScreen: "entry" | "verify";
  onFlowChange: (state: { email: string; screen: "entry" | "verify" }) => void;
  onFlowReset: () => void;
}

/**
 * Lifts sessionStorage hydration and persistence out of the wrapped component.
 * Read happens in a lazy useState initializer so the first paint already reflects the persisted flow.
 * Intended to be combined with `dynamic({ ssr: false })` at the route entry to avoid SSR hydration mismatch.
 */
export function withPersistedPasswordlessFlow<P extends PassedFlowProps>(Component: ComponentType<P>): ComponentType<Omit<P, keyof PassedFlowProps>> {
  function WithPersistedPasswordlessFlow(outerProps: Omit<P, keyof PassedFlowProps>) {
    const [initial] = useState(readPersistedFlow);

    const onFlowChange = useCallback(function persistPasswordlessFlow(state: { email: string; screen: "entry" | "verify" }) {
      try {
        if (state.screen !== "verify") {
          window.sessionStorage.removeItem(EMAIL_CODE_FLOW_STORAGE_KEY);
          return;
        }
        window.sessionStorage.setItem(EMAIL_CODE_FLOW_STORAGE_KEY, JSON.stringify(state));
      } catch {
        return;
      }
    }, []);

    const onFlowReset = useCallback(function clearPersistedPasswordlessFlow() {
      try {
        window.sessionStorage.removeItem(EMAIL_CODE_FLOW_STORAGE_KEY);
      } catch {
        return;
      }
    }, []);

    return (
      <Component {...(outerProps as P)} initialEmail={initial.email} initialScreen={initial.screen} onFlowChange={onFlowChange} onFlowReset={onFlowReset} />
    );
  }
  WithPersistedPasswordlessFlow.displayName = `withPersistedPasswordlessFlow(${Component.displayName ?? Component.name ?? "Component"})`;
  return WithPersistedPasswordlessFlow;
}

/** Read `{ email, screen }` from sessionStorage; defaults to empty entry when missing, corrupted, or server-side. */
function readPersistedFlow(): { email: string; screen: "entry" | "verify" } {
  if (typeof window === "undefined") return { email: "", screen: "entry" };
  try {
    const raw = window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY);
    if (!raw) return { email: "", screen: "entry" };
    const parsed = JSON.parse(raw) as { email?: unknown; screen?: unknown };
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      screen: parsed.screen === "verify" ? "verify" : "entry"
    };
  } catch {
    return { email: "", screen: "entry" };
  }
}
