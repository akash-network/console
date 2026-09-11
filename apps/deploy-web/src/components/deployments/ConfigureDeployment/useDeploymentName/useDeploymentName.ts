import { useState } from "react";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";

export const DEPENDENCIES = { useResolvedDeploymentName };

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

/** Owns the configure session's deployment name: the api's own once the deployment exists, and the typed one before that. */
export function useDeploymentName({ initialName, dseq }: UseDeploymentNameInput, dependencies = DEPENDENCIES): DeploymentName {
  const [typedName, setTypedName] = useState(() => (initialName ?? "").slice(0, MAX_DEPLOYMENT_NAME_LENGTH));
  const resolvedName = dependencies.useResolvedDeploymentName(dseq);
  return { name: typedName || resolvedName || "", typedName, setName: setTypedName };
}
