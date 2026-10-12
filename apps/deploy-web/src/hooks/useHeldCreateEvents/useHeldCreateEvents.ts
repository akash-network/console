import { useCallback } from "react";
import { atom, useSetAtom, useStore } from "jotai";

import type { EventProperties } from "@src/services/analytics/analytics.service";

const heldCreateEventsAtom = atom<ReadonlyMap<string, EventProperties>>(new Map<string, EventProperties>());

/** Holds the `create_deployment` event of a create sent to the background under its activity, so it is tracked once the create succeeds wherever the user is by then. */
export function useHoldCreateEvent() {
  const setHeld = useSetAtom(heldCreateEventsAtom);

  return useCallback(
    (activityId: string, properties: EventProperties) => {
      setHeld(current => new Map(current).set(activityId, properties));
    },
    [setHeld]
  );
}

/** Hands a held event out once, so a create whose outcome is read again is never tracked twice. */
export function useTakeHeldCreateEvent() {
  const store = useStore();

  return useCallback(
    (activityId: string): EventProperties | undefined => {
      const held = store.get(heldCreateEventsAtom);
      const properties = held.get(activityId);
      if (properties) store.set(heldCreateEventsAtom, new Map([...held].filter(([id]) => id !== activityId)));
      return properties;
    },
    [store]
  );
}
