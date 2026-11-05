"use client";
import type { FC } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { AssistantActionOf } from "@src/types/assistant";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useServices, useUser, ActionCardChrome };

type Interconnect = AssistantActionOf<"request_hardware">["interconnect"];

export const INTERCONNECT_LABELS: Record<Interconnect, string> = {
  none: "Not needed",
  server: "Between GPUs in one server",
  cluster: "Between servers"
};

/** The request has no interconnect field, so the card writes it into the details the team reads, after the user's own notes. */
export function hardwareRequestDetailsOf(action: AssistantActionOf<"request_hardware">): string | undefined {
  const lines = [action.notes, action.interconnect === "none" ? null : `Interconnect: ${INTERCONNECT_LABELS[action.interconnect]}`];
  return lines.filter(Boolean).join("\n") || undefined;
}

export const RequestHardwareCard: FC<ActionCardProps<"request_hardware"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const { user } = d.useUser();
  const { mutateAsync: createHardwareRequest } = api.v1.createHardwareRequest.useMutation();
  const email = user?.email;

  return (
    <d.ActionCardChrome
      title="Request hardware"
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "GPU model", value: action.gpuModel },
        { label: "GPU count", value: String(action.gpuCount) },
        { label: "GPU interconnect", value: INTERCONNECT_LABELS[action.interconnect] },
        ...(action.notes ? [{ label: "Notes", value: action.notes }] : []),
        { label: "Reply to", value: email ?? "No email on your account" }
      ]}
      costNote="Sends the request to the Akash team, who follow up by email. Nothing is reserved or charged."
      confirmLabel="Send request"
      successMessage="Request sent. We'll follow up by email."
      isConfirmDisabled={!email}
      onConfirm={async () => {
        await createHardwareRequest({
          data: { category: "gpu_model", gpuModel: action.gpuModel, quantity: action.gpuCount, email: email!, details: hardwareRequestDetailsOf(action) }
        });
      }}
    />
  );
};
