"use client";
import type { FC } from "react";
import { useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input } from "@akashnetwork/ui/components";
import { ChevronDownIcon, CopyIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";

import type { SdlBuilderFormValuesType } from "@src/types";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";
import { copyTextToClipboard } from "@src/utils/copyClipboard";

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);
const EMPTY_STATE = "No variables or secrets yet. Add a variable for a plain key/value pair.";
const REPLACE_SECRET_PLACEHOLDER = "Enter new value to update";

export interface UpdateVariablesPanelProps {
  serviceIndex: number;
  locked: boolean;
}

interface EnvRow {
  envIndex: number;
  fieldId: string;
}

/** A secret shows by name only: its value is held encrypted by the console and never comes back to the browser. */
export const UpdateVariablesPanel: FC<UpdateVariablesPanelProps> = ({ serviceIndex, locked }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.env`, keyName: "fieldId" });
  const env = useWatch({ control, name: `services.${serviceIndex}.env` }) ?? [];
  const rows = fields.map((field, envIndex) => ({ envIndex, fieldId: field.fieldId, key: field.key, isSecret: !!env[envIndex]?.isSecret }));
  const visibleRows = rows.filter(row => !RESERVED_ENV_KEYS.has(row.key));
  const variables = visibleRows.filter(row => !row.isSecret);
  const secrets = visibleRows.filter(row => row.isSecret);

  function addVariable() {
    append({ id: nanoid(), key: "", value: "", isSecret: false });
  }

  return (
    <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      {visibleRows.length === 0 && <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>}

      {variables.length > 0 && (
        <RowGroup title="Variables" icon={<KeyRoundIcon className="h-4 w-4" aria-hidden="true" />}>
          {variables.map((row: EnvRow, position) => (
            <VariableRow key={row.fieldId} serviceIndex={serviceIndex} envIndex={row.envIndex} position={position + 1} onRemove={() => remove(row.envIndex)} />
          ))}
        </RowGroup>
      )}

      {secrets.length > 0 && (
        <RowGroup title="Secrets" icon={<LockIcon className="h-4 w-4" aria-hidden="true" />}>
          {secrets.map((row: EnvRow, position) => (
            <SecretRow key={row.fieldId} serviceIndex={serviceIndex} envIndex={row.envIndex} position={position + 1} />
          ))}
        </RowGroup>
      )}

      <div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Add
              <ChevronDownIcon className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem className="flex-col items-start gap-0.5" onSelect={addVariable}>
              <span className="text-sm font-medium">Variable</span>
              <span className="text-xs text-muted-foreground">Plain key/value, visible in the SDL</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-col items-start gap-0.5" disabled>
              <span className="text-sm font-medium">Secret</span>
              <span className="text-xs text-muted-foreground">Adding secrets to a running deployment is not available yet</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </fieldset>
  );
};

const RowGroup: FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="flex flex-col gap-2">
    <p className="flex items-center gap-2 text-sm font-medium">
      {icon}
      {title}
    </p>
    {children}
  </div>
);

interface RowProps {
  serviceIndex: number;
  envIndex: number;
  position: number;
  onRemove: () => void;
}

const VariableRow: FC<RowProps> = ({ serviceIndex, envIndex, position, onRemove }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const key = useController({ control, name: `services.${serviceIndex}.env.${envIndex}.key` });
  const value = useController({ control, name: `services.${serviceIndex}.env.${envIndex}.value` });
  const [isRevealed, setRevealed] = useState(false);
  const label = key.field.value?.trim() || `Variable ${position}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <Input
          aria-label={`Variable ${position} name`}
          placeholder="KEY"
          value={key.field.value ?? ""}
          onChange={key.field.onChange}
          onBlur={key.field.onBlur}
          error={!!key.fieldState.error}
          inputClassName="h-10 font-mono"
          className="flex-1"
        />
        <Input
          aria-label={`${label} value`}
          type={isRevealed ? "text" : "password"}
          autoComplete="off"
          placeholder="value"
          value={value.field.value ?? ""}
          onChange={value.field.onChange}
          onBlur={value.field.onBlur}
          error={!!value.fieldState.error}
          inputClassName="h-10 font-mono"
          className="flex-[2]"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-10 w-10 shrink-0"
          aria-label={`${isRevealed ? "Hide" : "Show"} ${label} value`}
          onClick={() => setRevealed(revealed => !revealed)}
        >
          {isRevealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-10 w-10 shrink-0"
          aria-label={`Copy ${label} value`}
          onClick={() => copyTextToClipboard(value.field.value ?? "")}
        >
          <CopyIcon className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label={`Remove ${label}`} onClick={onRemove}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      {key.fieldState.error && <p className="text-xs text-destructive">{key.fieldState.error.message}</p>}
      {value.fieldState.error && <p className="text-xs text-destructive">{value.fieldState.error.message}</p>}
    </div>
  );
};

/** Removing a secret prunes its stored value for good, so it waits for secret editing, which can also add one back. */
const SecretRow: FC<Omit<RowProps, "onRemove">> = ({ serviceIndex, envIndex, position }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const name = useWatch({ control, name: `services.${serviceIndex}.env.${envIndex}.key` }) ?? "";

  return (
    <div className="flex items-start gap-2">
      <Input aria-label={`Secret ${position} name`} value={name} readOnly inputClassName="h-10 font-mono" className="flex-1" />
      <Input aria-label={`${name} value`} placeholder={REPLACE_SECRET_PLACEHOLDER} value="" disabled readOnly inputClassName="h-10" className="flex-[2]" />
      <span aria-hidden="true" className="w-[5.5rem] shrink-0" />
      <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label={`Remove ${name}`} disabled>
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
