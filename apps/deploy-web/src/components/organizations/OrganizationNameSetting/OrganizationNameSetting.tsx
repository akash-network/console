"use client";
import type { FC, FormEvent, KeyboardEvent } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { Input, LoadingButton, Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import {
  INVALID_ORGANIZATION_NAME_MESSAGE,
  MAX_ORGANIZATION_NAME_LENGTH,
  ORGANIZATION_NAME_TAKEN_MESSAGE
} from "@src/components/organizations/CreateOrganizationDialog/CreateOrganizationDialog";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useRenameOrganizationMutation } from "@src/queries/useOrganizationQueries";
import { ORGANIZATION_NAME_TAKEN_ERROR_CODE, type OrganizationOutput } from "@src/types/organization";

export const ORGANIZATION_NAME_DESCRIPTION = "Shown to members across Console and in invitations.";

const MIN_ORGANIZATION_NAME_LENGTH = 2;

const BAD_REQUEST_STATUS = 400;

export const DEPENDENCIES = { useActiveOrganization, useRenameOrganizationMutation, useSnackbar };

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name">;
  dependencies?: typeof DEPENDENCIES;
};

export const OrganizationNameSetting: FC<Props> = ({ organization, dependencies: d = DEPENDENCIES }) => {
  const { organizations } = d.useActiveOrganization();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: renameOrganization, isPending } = d.useRenameOrganizationMutation();
  const inputId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(organization.name);
  const [refusal, setRefusal] = useState<string>();

  const cleanName = collapseSpaces(name);
  const isChanged = cleanName !== collapseSpaces(organization.name);
  const isTaken = isChanged && organizations.some(other => other.id !== organization.id && other.name.trim().toLowerCase() === cleanName.toLowerCase());
  const error = isTaken ? ORGANIZATION_NAME_TAKEN_MESSAGE : refusal;
  const canSave = isChanged && !error && cleanName.length >= MIN_ORGANIZATION_NAME_LENGTH && !isPending;

  const typeName = (value: string) => {
    setName(value);
    setRefusal(undefined);
  };

  const revertOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") typeName(organization.name);
  };

  const reportRefusal = (refused: unknown) => {
    if (extractApiErrorCode(refused) === ORGANIZATION_NAME_TAKEN_ERROR_CODE) {
      setRefusal(ORGANIZATION_NAME_TAKEN_MESSAGE);
    } else if (isApiError(refused) && refused.status === BAD_REQUEST_STATUS) {
      setRefusal(INVALID_ORGANIZATION_NAME_MESSAGE);
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't rename the organization" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    const previousName = organization.name;
    renameOrganization(
      { id: organization.id, data: { name: cleanName } },
      {
        onSuccess: ({ data: renamed }) => {
          setName(renamed.name);
          enqueueSnackbar(<Snackbar title="Organization renamed" subTitle={`${previousName} is now ${renamed.name}.`} iconVariant="success" />, {
            variant: "success"
          });
        },
        onError: reportRefusal
      }
    );
  };

  return (
    <SettingsRow
      label="Name"
      htmlFor={inputId}
      description={
        <span id={descriptionId} aria-live="polite" className={error ? "text-destructive" : undefined}>
          {error ?? ORGANIZATION_NAME_DESCRIPTION}
        </span>
      }
    >
      <form onSubmit={saveName} className="flex w-full items-center gap-2 sm:w-auto">
        <Input
          id={inputId}
          value={name}
          onChange={event => typeName(event.target.value)}
          onKeyDown={revertOnEscape}
          maxLength={MAX_ORGANIZATION_NAME_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={descriptionId}
          className="min-w-0 flex-1 sm:w-[240px] sm:flex-none"
          inputClassName="h-9"
        />
        <LoadingButton type="submit" size="md" loading={isPending} disabled={!canSave}>
          Save
        </LoadingButton>
      </form>
    </SettingsRow>
  );
};

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
