"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Input } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { REGISTRY_PASSWORD_SECRET_NAME, secretReferenceOf } from "@src/utils/sdl/sdlSecrets";
import { SecureSecretInput, useSecureSecretInput } from "../../SecureSecretInput/SecureSecretInput";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { mintFreshSecretName } from "../mintFreshSecretName/mintFreshSecretName";
import { useAssistantDeploymentPatch } from "../useAssistantDeploymentPatch/useAssistantDeploymentPatch";

export const DEPENDENCIES = { useServices, useSecureSecretInput, useAssistantDeploymentPatch, ActionCardChrome, SecureSecretInput };

/** The password lives only in the secure input and leaves the browser sealed; the username is not a secret and is sent as typed, like the update tab's. */
export const SetRegistryCredentialsCard: FC<ActionCardProps<"set_registry_credentials"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const password = d.useSecureSecretInput();
  const patch = d.useAssistantDeploymentPatch();
  const [username, setUsername] = useState(action.usernameHint ?? "");
  const isSettled = decision.status === "succeeded" || decision.status === "cancelled";
  const forgetPassword = password.clear;
  const rows: ActionCardRow[] = [{ label: "Registry", value: action.host }, ...(action.image ? [{ label: "Image", value: action.image }] : [])];

  useEffect(
    function forgetPasswordOnceSettled() {
      if (isSettled) forgetPassword();
    },
    [isSettled, forgetPassword]
  );

  const saveCredentials = async () => {
    const { data } = await api.v1.getDeployment.queryOptions({ dseq: action.dseq }).queryFn();
    const passwordName = mintFreshSecretName(data.consoleSettings?.sdl, REGISTRY_PASSWORD_SECRET_NAME);
    const sealedSecrets = await password.sealAndClear(passwordName);
    const credentials = { host: action.host, username: username.trim(), password: secretReferenceOf(passwordName) };
    await patch({ dseq: action.dseq, services: { [action.service]: { credentials } }, sealedSecrets });
  };

  return (
    <d.ActionCardChrome
      title={`Add registry credentials to deployment ${action.dseq}`}
      scope={`service: ${action.service}`}
      tier={action.tier}
      decision={decision}
      rows={rows}
      costNote="The container restarts once and pulls the image with these credentials."
      confirmLabel="Save credentials"
      successMessage="Credentials saved. Follow the rollout in Activities."
      isConfirmDisabled={!password.hasValue || username.trim().length === 0}
      onConfirm={saveCredentials}
    >
      {!isSettled && (
        <>
          <Input
            label="Username"
            value={username}
            autoComplete="off"
            spellCheck={false}
            disabled={decision.status === "running"}
            onChange={event => setUsername(event.target.value)}
          />
          <d.SecureSecretInput label="Password or token" secret={password} disabled={decision.status === "running"} />
        </>
      )}
    </d.ActionCardChrome>
  );
};
