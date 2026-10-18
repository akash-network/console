import type { PropsWithChildren } from "react";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it } from "vitest";

import type { HeldActivityEvent } from "./useHeldActivityEvents";
import { useHoldActivityEvents, useTakeHeldActivityEvents } from "./useHeldActivityEvents";

import { act, renderHook } from "@testing-library/react";

describe("useHeldActivityEvents", () => {
  const LEASE_EVENTS: HeldActivityEvent[] = [
    { event: "create_lease", properties: { category: "deployments", dseq: "1234" } },
    { event: "send_manifest", properties: { category: "deployments", dseq: "1234" } }
  ];

  it("hands out the events held for an activity", () => {
    const { hold, take } = setup();

    act(() => hold("activity-1", LEASE_EVENTS));

    expect(take("activity-1")).toEqual(LEASE_EVENTS);
  });

  it("hands the events out only once", () => {
    const { hold, take } = setup();
    act(() => hold("activity-1", LEASE_EVENTS));

    take("activity-1");

    expect(take("activity-1")).toEqual([]);
  });

  it("keeps the events of other activities when one is handed out", () => {
    const { hold, take } = setup();
    const otherEvents: HeldActivityEvent[] = [{ event: "create_lease", properties: { dseq: "5678" } }];
    act(() => {
      hold("activity-1", LEASE_EVENTS);
      hold("activity-2", otherEvents);
    });

    take("activity-1");

    expect(take("activity-2")).toEqual(otherEvents);
  });

  it("hands out nothing for an activity nothing was held for", () => {
    const { take } = setup();

    expect(take("activity-1")).toEqual([]);
  });

  function setup() {
    const store = createStore();
    const { result } = renderHook(() => ({ hold: useHoldActivityEvents(), take: useTakeHeldActivityEvents() }), {
      wrapper: ({ children }: PropsWithChildren) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>
    });

    return { hold: result.current.hold, take: result.current.take };
  }
});
