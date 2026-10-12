import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useHoldCreateEvent, useTakeHeldCreateEvent } from "./useHeldCreateEvents";

import { act, renderHook } from "@testing-library/react";

describe(useTakeHeldCreateEvent.name, () => {
  it("hands out the event held for a create", () => {
    const { result } = setup();
    act(() => result.current.hold("activity-1", { category: "deployments", dseq: "1234" }));

    expect(result.current.take("activity-1")).toEqual({ category: "deployments", dseq: "1234" });
  });

  it("hands a held event out only once", () => {
    const { result } = setup();
    act(() => result.current.hold("activity-1", { dseq: "1234" }));

    result.current.take("activity-1");

    expect(result.current.take("activity-1")).toBeUndefined();
  });

  it("hands out nothing for a create no event was held for", () => {
    const { result } = setup();
    act(() => result.current.hold("activity-1", { dseq: "1234" }));

    expect(result.current.take("activity-2")).toBeUndefined();
  });

  it("keeps the events of other creates when one is handed out", () => {
    const { result } = setup();
    act(() => {
      result.current.hold("activity-1", { dseq: "1234" });
      result.current.hold("activity-2", { dseq: "5678" });
    });

    result.current.take("activity-1");

    expect(result.current.take("activity-2")).toEqual({ dseq: "5678" });
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ hold: useHoldCreateEvent(), take: useTakeHeldCreateEvent() }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });
  }
});
