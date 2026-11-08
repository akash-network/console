import type { FC } from "react";
import { Alert, AlertDescription } from "@akashnetwork/ui/components";

import type { UnaskableSecret } from "../buildAskedValues";

/** A secret's value is never saved, so a secret the deployer cannot be asked for leaves the template undeployable; it blocks saving until renamed. */
export const UnaskableSecretsAlert: FC<{ unaskableSecrets: UnaskableSecret[]; className?: string }> = ({ unaskableSecrets, className }) => {
  if (unaskableSecrets.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>
        {unaskableSecrets.map(({ service, key }) => (
          <p key={`${service}:${key}`}>{`Rename ${key} in ${service}: a secret's key can only use letters, digits and underscores.`}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
};
