import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useServices, useResolvedDeploymentName };

export interface DeploymentName {
  /** The name to show: the one typed in this session, and the api's own only where this session has none. */
  name: string;
  /** The name this session typed, and only that: what the draft records and the next create carries, so a name the api derived is never persisted as the user's own nor sent back as one. */
  typedName: string;
  setName: (name: string) => void;
}

interface UseDeploymentNameInput {
  /** The name to start from — the resumed draft's name, or the template's, resolved by the caller. */
  initialName?: string;
  /** The created deployment's sequence, from `useDeploymentFlow`; null until quotes are requested. */
  dseq: string | null;
}

/** Owns the configure session's deployment name: the api's own once the deployment exists, the typed one before that, and the write of the typed one to the wallet-scoped local record `settingsId` keys. */
export function useDeploymentName({ initialName, dseq }: UseDeploymentNameInput, dependencies = DEPENDENCIES): DeploymentName {
  const { deploymentLocalStorage } = dependencies.useServices();
  const settingsId = useAtomValue(settingsIdAtom);
  const [typedName, setTypedName] = useState(() => (initialName ?? "").slice(0, MAX_DEPLOYMENT_NAME_LENGTH));
  const nameRef = useRef(typedName);
  nameRef.current = typedName;
  const resolvedName = dependencies.useResolvedDeploymentName(dseq);
  /** Seeded with the mounting `dseq`, so a session resumed already carrying one is treated as written and never clobbers a name edited since on the deployment page. */
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
  return { name: typedName || resolvedName || "", typedName, setName: setTypedName };
}
