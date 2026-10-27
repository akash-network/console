import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

/** The configure link that runs each one-click deploy again, by dseq; held in memory, so it covers only the deploys this tab sent. */
export type OneClickDeploys = ReadonlyMap<string, string>;

const oneClickDeploysAtom = atom<OneClickDeploys>(new Map<string, string>());

export function useOneClickDeploys(): OneClickDeploys {
  return useAtomValue(oneClickDeploysAtom);
}

export function useRecordOneClickDeploy() {
  const setOneClickDeploys = useSetAtom(oneClickDeploysAtom);

  return useCallback(
    (dseq: string, deployAgainHref: string) => setOneClickDeploys(current => new Map(current).set(dseq, deployAgainHref)),
    [setOneClickDeploys]
  );
}
