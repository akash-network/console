"use client";
import type { FC } from "react";
import { useEffect } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { secretReferenceOf } from "@src/utils/sdl/sdlSecrets";
import { SecureSecretInput, useSecureSecretInput } from "../../SecureSecretInput/SecureSecretInput";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { mintFreshSecretName } from "../mintFreshSecretName/mintFreshSecretName";
import { useAssistantDeploymentPatch } from "../useAssistantDeploymentPatch/useAssistantDeploymentPatch";
import { deploymentLabelOf, useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useServices, useSecureSecretInput, useAssistantDeploymentPatch, useDeploymentName, ActionCardChrome, SecureSecretInput };

/** The typed value lives only in the secure input and leaves the browser sealed, never through the card's props, state or the decision it records. */
export const SetSecretCard: FC<ActionCardProps<"set_secret"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const secret = d.useSecureSecretInput();
  const patch = d.useAssistantDeploymentPatch();
  const deploymentName = d.useDeploymentName(action.dseq);
  const isSettled = decision.status === "succeeded" || decision.status === "cancelled";
  const forgetSecret = secret.clear;

  useEffect(
    function forgetValueOnceSettled() {
      if (isSettled) forgetSecret();
    },
    [isSettled, forgetSecret]
  );

  const saveSecret = async () => {
    const { data } = await api.v1.getDeployment.queryOptions({ dseq: action.dseq }).queryFn();
    const secretName = mintFreshSecretName(data.consoleSettings?.sdl, action.name);
    const sealedSecrets = await secret.sealAndClear(secretName);
    await patch({ dseq: action.dseq, services: { [action.service]: { env: { [action.name]: secretReferenceOf(secretName) } } }, sealedSecrets });
  };

  return (
    <d.ActionCardChrome
      title={`${action.replacesExisting ? "Replace a secret in" : "Add a secret to"} ${deploymentLabelOf(deploymentName)}`}
      scope={`service: ${action.service}`}
      tier={action.tier}
      decision={decision}
      rows={[{ label: "Name", value: action.name }]}
      costNote="The container restarts once to pick up the new value."
      confirmLabel="Save secret"
      successMessage="Secret saved. Follow the rollout in Activities."
      isConfirmDisabled={!secret.hasValue}
      onConfirm={saveSecret}
    >
      {!isSettled && <d.SecureSecretInput label="Value" secret={secret} disabled={decision.status === "running"} />}
    </d.ActionCardChrome>
  );
};
