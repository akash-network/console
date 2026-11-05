import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import { useAssistantPanel } from "./useAssistantPanel";

import { act, renderHook } from "@testing-library/react";

describe(useAssistantPanel.name, () => {
  it("starts closed", () => {
    const { result } = setup();

    expect(result.current).toEqual(expect.objectContaining({ isOpen: false, request: {}, openedAt: 0 }));
  });

  it("opens with the request and when it was made, and closes keeping the request", () => {
    vi.useFakeTimers({ now: 1_000 });
    const { result } = setup();

    act(() => result.current.open({ context: { dseq: "42" }, question: "Why no bids?" }));
    expect(result.current).toEqual(expect.objectContaining({ isOpen: true, request: { context: { dseq: "42" }, question: "Why no bids?" }, openedAt: 1_000 }));

    act(() => result.current.close());
    expect(result.current).toEqual(expect.objectContaining({ isOpen: false, request: { context: { dseq: "42" }, question: "Why no bids?" } }));

    act(() => result.current.open());
    expect(result.current.request).toEqual({});
    vi.useRealTimers();
  });

  function setup() {
    const store = createStore();
    return renderHook(() => useAssistantPanel(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
  }
});
