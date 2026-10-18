import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";

type ActionAnsweredOnItsPage = Extract<Activity["type"], "deployment_create" | "deployment_update" | "lease_create">;

type ShownOutcome = Extract<Activity["status"], "succeeded" | "failed">;

const handledOutcomesAtom = atom<ReadonlySet<string>>(new Set<string>());

function actionKeyOf(type: Activity["type"], dseq: string | undefined) {
  return `${type}:${dseq}:`;
}

function outcomeKeyOf(type: Activity["type"], dseq: string | undefined, status: Activity["status"]) {
  return `${actionKeyOf(type, dseq)}${status}`;
}

/** Keyed by the activity alone, because a page that follows an activity until it settles shows however it ends, even after the host saw it pending. */
function followedKeyOf(activityId: string) {
  return `followed:${activityId}`;
}

function without(keys: ReadonlySet<string>, dropped: string[]) {
  return new Set([...keys].filter(key => !dropped.includes(key)));
}

/** The outcomes a page of this tab waited for and showed itself, which the activity host then leaves unannounced. */
export function useHandledActivityOutcomes() {
  const handledOutcomes = useAtomValue(handledOutcomesAtom);
  const setHandledOutcomes = useSetAtom(handledOutcomesAtom);

  const isOutcomeHandled = useCallback(
    (activity: Activity) => handledOutcomes.has(outcomeKeyOf(activity.type, activity.meta.dseq, activity.status)),
    [handledOutcomes]
  );
  const isFollowedOnItsPage = useCallback((activity: Activity) => handledOutcomes.has(followedKeyOf(activity.id)), [handledOutcomes]);
  const forgetHandledOutcome = useCallback(
    (activity: Activity) => {
      const handledKeys = [outcomeKeyOf(activity.type, activity.meta.dseq, activity.status), followedKeyOf(activity.id)];
      setHandledOutcomes(current => without(current, handledKeys));
    },
    [setHandledOutcomes]
  );

  return { isOutcomeHandled, isFollowedOnItsPage, forgetHandledOutcome };
}

/** Lets a page tell the activity host which outcome it showed, after dropping what an earlier attempt marked so a refused one can't silence the next. */
export function useMarkActivityOutcomes() {
  const setHandledOutcomes = useSetAtom(handledOutcomesAtom);

  const forgetEarlierOutcomes = useCallback(
    (type: ActionAnsweredOnItsPage, dseq: string) => {
      const actionKey = actionKeyOf(type, dseq);
      setHandledOutcomes(current => new Set([...current].filter(key => !key.startsWith(actionKey))));
    },
    [setHandledOutcomes]
  );
  const markOutcomeHandled = useCallback(
    (type: ActionAnsweredOnItsPage, dseq: string, status: ShownOutcome) => {
      setHandledOutcomes(current => new Set(current).add(outcomeKeyOf(type, dseq, status)));
    },
    [setHandledOutcomes]
  );
  const followUntilSettled = useCallback(
    (activityId: string) => {
      setHandledOutcomes(current => new Set(current).add(followedKeyOf(activityId)));
    },
    [setHandledOutcomes]
  );
  const stopFollowing = useCallback(
    (activityId: string) => {
      setHandledOutcomes(current => without(current, [followedKeyOf(activityId)]));
    },
    [setHandledOutcomes]
  );

  return { forgetEarlierOutcomes, markOutcomeHandled, followUntilSettled, stopFollowing };
}
