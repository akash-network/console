import { useCallback } from "react";
import { atom, useSetAtom, useStore } from "jotai";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { AnalyticsEvent, EventProperties } from "@src/services/analytics/analytics.service";

export interface HeldActivityEvent {
  event: AnalyticsEvent;
  properties: EventProperties;
}

type HeldOutcome = Extract<Activity["status"], "succeeded" | "failed">;

/** The events to track for each way the action can end. */
export type HeldActivityEvents = Partial<Record<HeldOutcome, HeldActivityEvent[]>>;

const heldActivityEventsAtom = atom<ReadonlyMap<string, HeldActivityEvents>>(new Map<string, HeldActivityEvents>());

/** Holds the analytics events of an action sent to the background under its activity, so they are tracked once it ends wherever the user is by then. */
export function useHoldActivityEvents() {
  const setHeld = useSetAtom(heldActivityEventsAtom);

  return useCallback(
    (activityId: string, events: HeldActivityEvents) => {
      setHeld(current => new Map(current).set(activityId, events));
    },
    [setHeld]
  );
}

/** Hands the held events out once, so an action whose outcome is read again is never tracked twice. */
export function useTakeHeldActivityEvents() {
  const store = useStore();

  return useCallback(
    (activityId: string): HeldActivityEvents => {
      const held = store.get(heldActivityEventsAtom);
      const events = held.get(activityId);
      if (!events) return {};

      store.set(heldActivityEventsAtom, new Map([...held].filter(([id]) => id !== activityId)));
      return events;
    },
    [store]
  );
}
