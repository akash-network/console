import { useCallback, useEffect, useRef } from "react";

type Input = {
  isRefusedForFunds: boolean;
  /** Captures what the refused request was built from; a different capture once credits land means the user edited it, so it is not resumed. */
  snapshotRequest?: () => string;
  resume: () => void;
};

const NOTHING_TO_SNAPSHOT = () => "";

/** A purchase can outlive the page that asked for it and the refusal it was for, so the returned callback resumes only while both still stand. */
export function useResumeAfterCredits({ isRefusedForFunds, snapshotRequest = NOTHING_TO_SNAPSHOT, resume }: Input) {
  const latestRef = useRef({ isRefusedForFunds, snapshotRequest, resume });
  latestRef.current = { isRefusedForFunds, snapshotRequest, resume };
  const requestAtRefusalRef = useRef<string>();
  const isMountedRef = useRef(false);

  useEffect(function trackMounted() {
    isMountedRef.current = true;
    return function markUnmounted() {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(
    function snapshotRequestAtRefusal() {
      if (isRefusedForFunds) requestAtRefusalRef.current = latestRef.current.snapshotRequest();
    },
    [isRefusedForFunds]
  );

  return useCallback(function resumeIfStillRefused() {
    const latest = latestRef.current;
    if (isMountedRef.current && latest.isRefusedForFunds && latest.snapshotRequest() === requestAtRefusalRef.current) latest.resume();
  }, []);
}
