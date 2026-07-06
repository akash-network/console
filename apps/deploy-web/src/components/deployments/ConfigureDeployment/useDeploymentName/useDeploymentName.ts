import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";

export const DEPENDENCIES = { useServices };

export interface DeploymentName {
  /** The current deployment name; seeded from `initialName`, edited via `setName`. */
  name: string;
  setName: (name: string) => void;
}

interface UseDeploymentNameInput {
  /** The name to start from — the resumed draft's name, or the template's, resolved by the caller. */
  initialName?: string;
  /** The created deployment's sequence, from `useDeploymentFlow`; null until quotes are requested. */
  dseq: string | null;
}

/**
 * Owns the configure session's deployment name: its state (seeded once from `initialName`) and its write to the
 * wallet-scoped local record the rest of the app reads via `useLocalNotes.getDeploymentName(dseq)`. The record is
 * keyed by `settingsId` — which WalletProvider sets to the wallet address — so the name surfaces on the deployment
 * list/detail pages after deploy, the same store the legacy builder wrote to. It deliberately avoids `useWallet()`,
 * so no new dependency on the wallet provider is introduced. The write happens once `dseq` and `settingsId` are both
 * present (the deployment is created for a known wallet); until the wallet-scoped key exists the write is deferred
 * rather than dropped. A session that resumed already carrying a `dseq` has it present from mount and is treated as
 * already-written, so a resume never clobbers a name the user may have since edited on the deployment page.
 */
export function useDeploymentName({ initialName, dseq }: UseDeploymentNameInput, dependencies = DEPENDENCIES): DeploymentName {
  const { deploymentLocalStorage } = dependencies.useServices();
  const settingsId = useAtomValue(settingsIdAtom);
  const [name, setName] = useState(() => initialName ?? "");
  const nameRef = useRef(name);
  nameRef.current = name;
  const writtenDseqRef = useRef(dseq);
  useEffect(
    function persistNameOnCreate() {
      if (dseq && settingsId && dseq !== writtenDseqRef.current) {
        writtenDseqRef.current = dseq;
        deploymentLocalStorage.update(settingsId, dseq, { name: nameRef.current });
      }
    },
    [dseq, settingsId, deploymentLocalStorage]
  );
  return { name, setName };
}
