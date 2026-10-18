import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";

type ActionAnsweredOnItsPage = Extract<Activity["type"], "deployment_create" | "deployment_update" | "lease_create">;

const handledOutcomesAtom = atom<ReadonlySet<string>>(new Set<string>());

function outcomeKeyOf(type: Activity["type"], dseq: string | undefined) {
  return `${type}:${dseq}`;
}

/** The outcomes a page of this tab waited for and showed itself, which the activity host then leaves unannounced. */
export function useHandledActivityOutcomes() {
  const handledOutcomes = useAtomValue(handledOutcomesAtom);
  const setHandledOutcomes = useSetAtom(handledOutcomesAtom);

  const isOutcomeHandled = useCallback((activity: Activity) => handledOutcomes.has(outcomeKeyOf(activity.type, activity.meta.dseq)), [handledOutcomes]);
  const forgetHandledOutcome = useCallback(
    (activity: Activity) => {
      setHandledOutcomes(current => new Set([...current].filter(key => key !== outcomeKeyOf(activity.type, activity.meta.dseq))));
    },
    [setHandledOutcomes]
  );

  return { isOutcomeHandled, forgetHandledOutcome };
}

/** Called by a page once it has shown how an action it sent ended, so the activity host doesn't toast that outcome a second time. */
export function useMarkActivityOutcomeHandled() {
  const setHandledOutcomes = useSetAtom(handledOutcomesAtom);

  return useCallback(
    (type: ActionAnsweredOnItsPage, dseq: string) => {
      setHandledOutcomes(current => new Set(current).add(outcomeKeyOf(type, dseq)));
    },
    [setHandledOutcomes]
  );
}
