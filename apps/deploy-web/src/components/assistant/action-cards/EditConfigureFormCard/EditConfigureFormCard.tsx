"use client";
import type { FC } from "react";

import type { AssistantActionOf } from "@src/types/assistant";
import { persistentStorageTypes } from "@src/utils/akash/units";
import { useConfigureFormRegistry, useIsConfigureFormOpen } from "../../configureFormRegistry/configureFormRegistry";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useConfigureFormRegistry, useIsConfigureFormOpen, ActionCardChrome };

type Action = AssistantActionOf<"edit_configure_form">;
type ServiceChanges = Action["services"][number]["changes"];
type PlacementChanges = Action["placements"][number]["changes"];

const FORM_CLOSED_MESSAGE = "Open the configure page to apply this change.";

/** Applies the edit to the open configure form only; the page screens providers again on its own and nothing is deployed. */
export const EditConfigureFormCard: FC<ActionCardProps<"edit_configure_form"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const configureForms = d.useConfigureFormRegistry();
  const isFormOpen = d.useIsConfigureFormOpen();

  const applyToForm = async () => {
    const form = configureForms.current;
    if (!form) throw new Error(FORM_CLOSED_MESSAGE);
    form.applyEdit({ services: action.services, placements: action.placements });
  };

  return (
    <d.ActionCardChrome
      title="Change the deployment settings"
      tier={action.tier}
      decision={decision}
      rows={rowsOf(action)}
      costNote="Only the form changes. Nothing is deployed until you deploy it."
      confirmLabel="Apply to the form"
      successMessage="Applied. The providers pane updates in a moment."
      isConfirmDisabled={!isFormOpen}
      onConfirm={applyToForm}
    >
      {!isFormOpen && decision.status === "pending" && <p className="text-sm text-muted-foreground">{FORM_CLOSED_MESSAGE}</p>}
    </d.ActionCardChrome>
  );
};

function rowsOf(action: Action): ActionCardRow[] {
  return [
    { label: "Why", value: action.reason },
    ...action.services.flatMap(({ service, changes }) => serviceRowsOf(changes).map(({ label, value }) => ({ label: `${service}: ${label}`, value }))),
    ...action.placements.flatMap(({ placement, changes }) => placementRowsOf(changes).map(({ label, value }) => ({ label: `${placement}: ${label}`, value })))
  ];
}

function serviceRowsOf(changes: ServiceChanges): ActionCardRow[] {
  return [
    ...(changes.image ? [{ label: "image", value: changes.image }] : []),
    ...(changes.cpu !== undefined ? [{ label: "CPU", value: `${changes.cpu} vCPU` }] : []),
    ...(changes.memory ? [{ label: "memory", value: changes.memory }] : []),
    ...(changes.ephemeralStorage ? [{ label: "storage", value: changes.ephemeralStorage }] : []),
    ...(changes.count !== undefined ? [{ label: "replicas", value: String(changes.count) }] : []),
    ...(changes.gpu ? [{ label: "GPU", value: describeGpu(changes.gpu) }] : []),
    ...(changes.persistentStorage ? [{ label: "persistent storage", value: describePersistentStorage(changes.persistentStorage) }] : [])
  ];
}

function placementRowsOf(changes: PlacementChanges): ActionCardRow[] {
  return [
    ...(changes.attributes ? [{ label: "attributes", value: changes.attributes.map(({ key, value }) => `${key}=${value}`).join(", ") || "none" }] : []),
    ...(changes.regions ? [{ label: "regions", value: changes.regions.join(", ") || "any region" }] : [])
  ];
}

function describeGpu({ units, models }: NonNullable<ServiceChanges["gpu"]>): string {
  if (units === 0) return "off";
  return models?.length ? `${units} x ${models.join(" or ")}` : `${units}`;
}

function describePersistentStorage(change: NonNullable<ServiceChanges["persistentStorage"]>): string {
  if (change.remove) return change.name ? `remove ${change.name}` : "off";

  const className = persistentStorageTypes.find(type => type.className === change.class)?.name ?? change.class;
  return [
    change.name,
    className,
    change.size,
    change.mount && `at ${change.mount}`,
    change.readOnly !== undefined && (change.readOnly ? "read only" : "writable")
  ]
    .filter(Boolean)
    .join(", ");
}
