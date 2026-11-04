import { useCallback, useEffect, useState } from "react";
import { atom, useAtom, useSetAtom } from "jotai";

/** Held in memory, so only a click in this tab sets it and a reload or a link from another site arrives without it. */
const autoDeployStartAtom = atom<string | null>(null);

/** Marks the template a deploy button of the console opens the configure screen for, which is what lets that screen deploy it on its own. */
export function useMarkAutoDeployStart() {
  const setAutoDeployStart = useSetAtom(autoDeployStartAtom);

  return useCallback((templateId: string) => setAutoDeployStart(templateId), [setAutoDeployStart]);
}

/** Taken once as the configure screen opens, so one click starts one deploy and any later visit finds nothing. */
export function useTakeAutoDeployStart(): string | null {
  const [autoDeployStart, setAutoDeployStart] = useAtom(autoDeployStartAtom);
  const [takenTemplateId] = useState(autoDeployStart);

  useEffect(
    function forgetTakenStart() {
      setAutoDeployStart(null);
    },
    [setAutoDeployStart]
  );

  return takenTemplateId;
}
