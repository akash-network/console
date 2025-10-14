import type { FC } from "react";
import { useMemo } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Alert, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useAsyncCallback } from "@src/hooks/useAsyncCallback/useAsyncCallback";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";

export const DEPENDENCIES = {
  Alert,
  Button,
  Spinner,
  useProviderCredentials
};

export interface Props extends Omit<ButtonProps, "onClick"> {
  afterCreate?: () => void;
  containerClassName?: string;
  dependencies?: typeof DEPENDENCIES;
}

const MESSAGES = {
  mtls: {
    expired: "Your certificate has expired. Please create a new one.",
    missing: "You need to create a certificate to view deployment details.",
    regenerateButton: "Regenerate Certificate",
    createButton: "Create Certificate",
    unableToCreate: "You cannot view deployment lease details because the blockchain is unavailable and you don't have a local certificate."
  },
  jwt: {
    expired: "Your token has expired. Please generate a new one.",
    missing: "You need to generate a token to view deployment details.",
    regenerateButton: "Regenerate Token",
    createButton: "Generate Token"
  }
};

export const CreateCredentialsButton: FC<Props> = ({ afterCreate, containerClassName, dependencies: d = DEPENDENCIES, ...buttonProps }) => {
  const credentials = d.useProviderCredentials();
  const [createCredentials, createCredentialsState] = useAsyncCallback(async () => {
    await credentials.generate();
    afterCreate?.();
  }, [credentials.generate, afterCreate]);
  const warningText = useMemo(() => {
    if (credentials.details.isExpired) return MESSAGES[credentials.details.type].expired;
    if (!credentials.details.value) return MESSAGES[credentials.details.type].missing;
    return undefined;
  }, [credentials]);
  const buttonText = useMemo(() => MESSAGES[credentials.details.type][credentials.details.isExpired ? "regenerateButton" : "createButton"], [credentials]);

  if (credentials.details.usable) return null;

  return (
    <div className={containerClassName}>
      <d.Alert variant="warning" className={cn({ "py-2 text-sm": buttonProps?.size === "sm" }, "truncate")}>
        {warningText}
      </d.Alert>
      <d.Button
        className={warningText ? "mt-4" : ""}
        {...buttonProps}
        disabled={buttonProps?.disabled || createCredentialsState.isPending}
        onClick={createCredentials}
      >
        {createCredentialsState.isPending ? <d.Spinner size="small" /> : buttonText}
      </d.Button>
    </div>
  );
};
