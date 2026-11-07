"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { Field, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@akashnetwork/ui/components";

import type { DeploymentCloseReason } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import {
  DEPLOYMENT_CLOSE_REASONS,
  MAX_CLOSE_REASON_DETAILS_LENGTH,
  toCloseReasonInput
} from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import { useServices } from "@src/context/ServicesProvider";
import { useCloseDeployment } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import { useCloseDeploymentConfirm } from "@src/hooks/useCloseDeploymentConfirm";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { deploymentLabelOf, useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useServices, useCloseDeployment, useCloseDeploymentConfirm, useDeploymentName, ActionCardChrome };

const SUCCESS_MESSAGES = {
  closed: "Closed. Unspent funds are back in your balance.",
  closing: "Closing. You'll get a notification when it's done."
};

export const CloseDeploymentCard: FC<ActionCardProps<"close_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { analyticsService } = d.useServices();
  const closeDeployment = d.useCloseDeployment();
  const { recordCloseReason } = d.useCloseDeploymentConfirm();
  const deploymentName = d.useDeploymentName(action.dseq, action.name);
  const [closeReason, setCloseReason] = useState<DeploymentCloseReason>(action.reason);
  const [details, setDetails] = useState(action.reasonDetails ?? "");
  const [outcome, setOutcome] = useState<keyof typeof SUCCESS_MESSAGES>("closed");
  const fieldIds = { reason: useId(), details: useId() };
  const isEditable = decision.status === "pending" || decision.status === "failed";

  const close = async () => {
    const result = await closeDeployment(action.dseq);
    if (result === "not_closed") throw new Error("The deployment wasn't closed. Try again in a moment.");

    setOutcome(result);
    recordCloseReason([action.dseq], toCloseReasonInput(closeReason, details));
    analyticsService.track("close_deployment", { category: "deployments", label: "Close deployment from the assistant", reason: closeReason });
  };

  return (
    <d.ActionCardChrome
      title={`Close ${deploymentLabelOf(deploymentName)}`}
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      costNote="All services stop right away and the deployment URL stops resolving. Unspent funds go back to your balance."
      irreversibleNote="This can't be undone. Running this workload again needs a new deployment."
      confirmLabel="Close deployment"
      successMessage={SUCCESS_MESSAGES[outcome]}
      onConfirm={close}
    >
      {isEditable && (
        <div className="flex flex-col gap-3">
          <Field className="gap-2">
            <FieldLabel htmlFor={fieldIds.reason}>Why are you closing this deployment?</FieldLabel>
            <Select value={closeReason} onValueChange={value => setCloseReason(value as DeploymentCloseReason)}>
              <SelectTrigger id={fieldIds.reason}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPLOYMENT_CLOSE_REASONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {closeReason === "other" && (
            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.details}>Tell us more (optional)</FieldLabel>
              <Textarea
                id={fieldIds.details}
                rows={2}
                maxLength={MAX_CLOSE_REASON_DETAILS_LENGTH}
                value={details}
                onChange={event => setDetails(event.target.value)}
              />
            </Field>
          )}
        </div>
      )}
    </d.ActionCardChrome>
  );
};
