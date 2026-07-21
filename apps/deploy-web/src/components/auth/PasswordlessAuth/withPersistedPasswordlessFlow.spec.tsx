import { describe, expect, it, vi } from "vitest";

import { EMAIL_CODE_FLOW_STORAGE_KEY, type PassedFlowProps, withPersistedPasswordlessFlow } from "./withPersistedPasswordlessFlow";

import { act, render } from "@testing-library/react";

describe(withPersistedPasswordlessFlow.name, () => {
  it("provides initialEmail from sessionStorage", () => {
    const { lastProps } = setup({ persistedEmail: "alice@example.com" });

    expect(lastProps().initialEmail).toBe("alice@example.com");
  });

  it("defaults to an empty email when sessionStorage is empty", () => {
    const { lastProps } = setup();

    expect(lastProps().initialEmail).toBe("");
  });

  it("defaults to an empty email when sessionStorage is corrupted", () => {
    const { lastProps } = setup({ persistedRaw: "{not json" });

    expect(lastProps().initialEmail).toBe("");
  });

  it("persists the email to sessionStorage on onEmailChange", () => {
    const { lastProps } = setup();

    act(() => {
      lastProps().onEmailChange("bob@example.com");
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBe(JSON.stringify({ email: "bob@example.com" }));
  });

  it("clears sessionStorage when onEmailChange is called with an empty email", () => {
    const { lastProps } = setup({ persistedEmail: "alice@example.com" });

    act(() => {
      lastProps().onEmailChange("");
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBeNull();
  });

  it("clears sessionStorage on onFlowReset", () => {
    const { lastProps } = setup({ persistedEmail: "alice@example.com" });

    act(() => {
      lastProps().onFlowReset();
    });

    expect(window.sessionStorage.getItem(EMAIL_CODE_FLOW_STORAGE_KEY)).toBeNull();
  });

  function setup(input: { persistedEmail?: string; persistedRaw?: string } = {}) {
    window.sessionStorage.clear();
    if (input.persistedEmail !== undefined) {
      window.sessionStorage.setItem(EMAIL_CODE_FLOW_STORAGE_KEY, JSON.stringify({ email: input.persistedEmail }));
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
