import { describe, expect, it, vi } from "vitest";

import { EMAIL_CODE_FLOW_STORAGE_KEY, type PassedFlowProps, withPersistedPasswordlessFlow } from "./withPersistedPasswordlessFlow";

import { act, render } from "@testing-library/react";

describe(withPersistedPasswordlessFlow.name, () => {
  it("provides initialEmail and initialScreen from sessionStorage", () => {
    const { lastProps } = setup({ persistedFlow: { email: "alice@example.com", screen: "verify" } });

    expect(lastProps().initialEmail).toBe("alice@example.com");
    expect(lastProps().initialScreen).toBe("verify");
  });

  it("defaults to empty entry when sessionStorage is empty", () => {
    const { lastProps } = setup();

    expect(lastProps().initialEmail).toBe("");
    expect(lastProps().initialScreen).toBe("entry");
  });

  it("defaults to empty entry when sessionStorage is corrupted", () => {
    const { lastProps } = setup({ persistedRaw: "{not json" });

    expect(lastProps().initialEmail).toBe("");
    expect(lastProps().initialScreen).toBe("entry");
  });

  it("persists flow state to sessionStorage on onFlowChange", () => {
    const { lastProps } = setup();

    act(() => {
      lastProps().onFlowChange({ email: "bob@example.com", screen: "verify" });
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBe(JSON.stringify({ email: "bob@example.com", screen: "verify" }));
  });

  it("clears sessionStorage when onFlowChange is called with entry state", () => {
    const { lastProps } = setup({ persistedFlow: { email: "alice@example.com", screen: "verify" } });

    act(() => {
      lastProps().onFlowChange({ email: "alice@example.com", screen: "entry" });
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBeNull();
  });

  it("clears sessionStorage on onFlowReset", () => {
    const { lastProps } = setup({ persistedFlow: { email: "alice@example.com", screen: "verify" } });

    act(() => {
      lastProps().onFlowReset();
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBeNull();
  });

  function setup(input: { persistedFlow?: { email: string; screen: "entry" | "verify" }; persistedRaw?: string } = {}) {
    window.sessionStorage.clear();
    if (input.persistedFlow) {
      window.sessionStorage.setItem(EMAIL_CODE_FLOW_STORAGE_KEY, JSON.stringify(input.persistedFlow));
    } else if (input.persistedRaw !== undefined) {
      window.sessionStorage.setItem(EMAIL_CODE_FLOW_STORAGE_KEY, input.persistedRaw);
    }
    const probe = vi.fn((_props: PassedFlowProps) => null);
    const Wrapped = withPersistedPasswordlessFlow(probe);
    render(<Wrapped />);
    return {
      lastProps: () => probe.mock.calls.at(-1)![0]
    };
  }
});
