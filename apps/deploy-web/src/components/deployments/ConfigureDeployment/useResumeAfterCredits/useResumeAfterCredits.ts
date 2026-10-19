import { useCallback, useEffect, useRef } from "react";

type Input = {
  isRefusedForFunds: boolean;
  /** What the refused request was built from and the user can still edit; a change since the refusal makes that request stale. */
  requestInputs?: readonly unknown[];
  resume: () => void;
};

const NO_REQUEST_INPUTS: readonly unknown[] = [];

/** A purchase can outlive the page that asked for it and the refusal it was for, so the returned callback resumes only while both still stand. */
export function useResumeAfterCredits({ isRefusedForFunds, requestInputs = NO_REQUEST_INPUTS, resume }: Input) {
  const latestRef = useRef({ isRefusedForFunds, requestInputs, resume });
  latestRef.current = { isRefusedForFunds, requestInputs, resume };
  const inputsAtRefusalRef = useRef(requestInputs);
  const isMountedRef = useRef(false);

  useEffect(function trackMounted() {
    isMountedRef.current = true;
    return function markUnmounted() {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(
    function rememberInputsAtRefusal() {
      if (isRefusedForFunds) inputsAtRefusalRef.current = latestRef.current.requestInputs;
    },
    [isRefusedForFunds]
  );

  return useCallback(function resumeIfStillRefused() {
    const latest = latestRef.current;
    const isRequestUnchanged = latest.requestInputs.every((input, index) => Object.is(input, inputsAtRefusalRef.current[index]));
    if (isMountedRef.current && latest.isRefusedForFunds && isRequestUnchanged) latest.resume();
  }, []);
}
