"use client";
import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert } from "@akashnetwork/ui/components";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { ServiceType } from "@src/types";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { holdsVariablesProtectedByDefault } from "./protectedVariables";

const PROTECTED_VARIABLES_NOTICE =
  "The console kept this deployment's variables as secrets when it was created, so their values can't be shown. To make one a plain variable again, remove it and add it back as a variable.";

export const ProtectedVariablesNotice: FC = () => {
  const { control } = useFormContext<DeploymentUpdateFormValues>();
  const services = useWatch({ control, name: "services" });

  return holdsVariablesProtectedByDefault(envOfServices(services)) ? <Alert>{PROTECTED_VARIABLES_NOTICE}</Alert> : null;
};

/** The log collector is managed for the user and never shown here, so its variables are left as they are. */
function envOfServices(services: ServiceType[] | undefined) {
  return (services ?? []).map(service => (isLogCollectorService(service) ? [] : service.env ?? []));
}
