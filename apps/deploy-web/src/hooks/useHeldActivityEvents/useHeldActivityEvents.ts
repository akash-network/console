import { useCallback } from "react";
import { atom, useSetAtom, useStore } from "jotai";

import type { AnalyticsEvent, EventProperties } from "@src/services/analytics/analytics.service";

export interface HeldActivityEvent {
  event: AnalyticsEvent;
  properties: EventProperties;
}

const heldActivityEventsAtom = atom<ReadonlyMap<string, HeldActivityEvent[]>>(new Map<string, HeldActivityEvent[]>());

/** Holds the analytics events of an action sent to the background under its activity, so they are tracked once it succeeds wherever the user is by then. */
export function useHoldActivityEvents() {
  const setHeld = useSetAtom(heldActivityEventsAtom);

  return useCallback(
    (activityId: string, events: HeldActivityEvent[]) => {
      setHeld(current => new Map(current).set(activityId, events));
    },
    [setHeld]
  );
}

/** Hands the held events out once, so an action whose outcome is read again is never tracked twice. */
export function useTakeHeldActivityEvents() {
  const store = useStore();

  return useCallback(
    (activityId: string): HeldActivityEvent[] => {
      const held = store.get(heldActivityEventsAtom);
      store.set(heldActivityEventsAtom, new Map([...held].filter(([id]) => id !== activityId)));
      return held.get(activityId) ?? [];
    },
    [store]
  );
}
