"use client";
import type { FC } from "react";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, Button } from "@akashnetwork/ui/components";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { ServiceType } from "@src/types";
import { BROWSER_RESTORE_LAST_DAY } from "@src/utils/sdl/browserRestoreDeadline";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { holdsVariablesProtectedByDefault, restoredEnvOf } from "./protectedVariables";

const LAST_RESTORE_DAY = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(BROWSER_RESTORE_LAST_DAY);
const RESTORABLE_NOTICE = `The console kept this deployment's variables as secrets when it was created, so their values are hidden. This browser still has them: restore them as plain variables, then update the deployment to keep them that way. You can restore them from this browser until ${LAST_RESTORE_DAY}.`;
const UNRESTORABLE_NOTICE =
  "The console kept this deployment's variables as secrets when it was created, so their values can't be shown. To make one a plain variable again, remove it and add it back as a variable.";

export interface ProtectedVariablesNoticeProps {
  /** Present only while this browser's copy of the deployment is the one the chain runs. */
  restoredSdl: string | undefined;
  locked: boolean;
}

/** Restoring only fills the form, so nothing moves out of secret storage until the user updates the deployment. */
export const ProtectedVariablesNotice: FC<ProtectedVariablesNoticeProps> = ({ restoredSdl, locked }) => {
  const { control, setValue } = useFormContext<DeploymentUpdateFormValues>();
  const services = useWatch({ control, name: "services" });
  const restoredEnv = useMemo(() => envOfServices(restoredServicesOf(restoredSdl)), [restoredSdl]);
  const currentEnv = envOfServices(services);
  const restorable = restoredEnvOf(currentEnv, restoredEnv);

  if (restorable.count > 0) {
    const restore = () => restorable.changes.forEach(change => setValue(`services.${change.serviceIndex}.env`, change.env, { shouldDirty: true }));

    return (
      <Alert className="flex flex-wrap items-center justify-between gap-3">
        <span>{RESTORABLE_NOTICE}</span>
        <Button type="button" variant="outline" size="sm" disabled={locked} onClick={restore}>
          Restore {restorable.count} {restorable.count === 1 ? "variable" : "variables"}
        </Button>
      </Alert>
    );
  }

  return holdsVariablesProtectedByDefault(currentEnv) ? <Alert>{UNRESTORABLE_NOTICE}</Alert> : null;
};

function restoredServicesOf(restoredSdl: string | undefined): ServiceType[] {
  if (!restoredSdl) return [];

  try {
    return importDeploymentState(restoredSdl).values.services;
  } catch {
    return [];
  }
}

/** The log collector is managed for the user and never shown here, so its variables are left as they are. */
function envOfServices(services: ServiceType[] | undefined) {
  return (services ?? []).map(service => (isLogCollectorService(service) ? [] : service.env ?? []));
}
