import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

/** The template each one-click deploy ran, by dseq; held in memory, so it covers only the deploys this tab sent. */
export type OneClickDeploys = ReadonlyMap<string, string | undefined>;

const oneClickDeploysAtom = atom<OneClickDeploys>(new Map<string, string | undefined>());

export function useOneClickDeploys(): OneClickDeploys {
  return useAtomValue(oneClickDeploysAtom);
}

export function useRecordOneClickDeploy() {
  const setOneClickDeploys = useSetAtom(oneClickDeploysAtom);

  return useCallback(
    (dseq: string, templateId: string | undefined) => setOneClickDeploys(current => new Map(current).set(dseq, templateId)),
    [setOneClickDeploys]
  );
}
