import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

const closeBatchesBeingSentAtom = atom<ReadonlySet<string>>(new Set<string>());

/** The bulk closes this tab is still sending, so the activity host never summarizes one before all of its closes are recorded. */
export function useCloseBatchesBeingSent(): ReadonlySet<string> {
  return useAtomValue(closeBatchesBeingSentAtom);
}

/** Sends a bulk close under a fresh batch id, reporting it as being sent until `send` settles. */
export function useSendCloseBatch() {
  const setBeingSent = useSetAtom(closeBatchesBeingSentAtom);

  return useCallback(
    async <T>(send: (batchId: string) => Promise<T>): Promise<T> => {
      const batchId = crypto.randomUUID();
      setBeingSent(current => new Set(current).add(batchId));

      try {
        return await send(batchId);
      } finally {
        setBeingSent(current => new Set([...current].filter(id => id !== batchId)));
      }
    },
    [setBeingSent]
  );
}
