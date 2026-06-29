"use client";
import { type ClipboardEvent, type FC, useCallback, useEffect, useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  CollapsibleCard,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input
} from "@akashnetwork/ui/components";
import { ChevronRightIcon, KeyRoundIcon, PlusIcon, SaveIcon, TrashIcon } from "lucide-react";
import { nanoid } from "nanoid";

import type { SdlBuilderFormValuesType } from "@src/types";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";

export const DEPENDENCIES = { CollapsibleCard, DialogV2, DialogV2Content, DialogV2Header, DialogV2Title, DialogV2Description, DialogV2Body, DialogV2Footer };

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);

type Props = {
  serviceIndex: number;
  /** While the pane is locked the dialog still opens for viewing but its inputs, Add/Remove and Save are disabled. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * "Environment Variables" card. The card is non-collapsible: clicking its header opens
 * a Dialog where the user edits key/value pairs. Changes are committed on Save; cancelled on Close.
 * The header shows the count of user-set variables (reserved keys like SSH_PUBKEY are excluded).
 */
export const EnvironmentVariablesCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, reset, trigger, formState } = useFormContext<SdlBuilderFormValuesType>();
  const hasEnvErrors = !!formState.errors.services?.[serviceIndex]?.env;
  const env = useWatch({ control, name: `services.${serviceIndex}.env` });
  const visibleCount = (env ?? []).filter(field => !RESERVED_ENV_KEYS.has(field.key)).length;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SdlBuilderFormValuesType | null>(null);

  const openModal = useCallback(() => {
    setSnapshot(structuredClone(getValues()));
    setOpen(true);
  }, [getValues]);

  const handleCancel = useCallback(() => {
    if (snapshot) {
      reset(snapshot, { keepErrors: true });
      void trigger(`services.${serviceIndex}.env`);
    }
    setOpen(false);
  }, [reset, trigger, snapshot, serviceIndex]);

  const handleSave = useCallback(() => {
    const current = getValues();
    const env = current.services[serviceIndex].env ?? [];
    current.services[serviceIndex].env = env.filter(e => e.key.trim() !== "" && !(RESERVED_ENV_KEYS.has(e.key) && e.id !== e.key));
    reset(current, { keepDirty: true, keepErrors: true });
    void trigger(`services.${serviceIndex}.env`);
    setOpen(false);
  }, [getValues, reset, trigger, serviceIndex]);

  return (
    <>
      <d.CollapsibleCard
        title="Environment Variables"
        icon={<KeyRoundIcon className="h-4 w-4" />}
        summary={
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{visibleCount}</span>
            <ChevronRightIcon className="size-4" />
          </div>
        }
        onHeaderClick={openModal}
      />

      <d.DialogV2
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) handleCancel();
        }}
      >
        <d.DialogV2Content className="max-w-lg" aria-describedby="env-vars-description">
          <d.DialogV2Header>
            <d.DialogV2Title>Environment variables</d.DialogV2Title>
            <d.DialogV2Description id="env-vars-description">
              Key/value pairs exposed to the container at runtime. Add as many as you need before saving.
            </d.DialogV2Description>
          </d.DialogV2Header>

          <d.DialogV2Body>
            <fieldset disabled={locked} className="contents">
              <EnvironmentVariablesList serviceIndex={serviceIndex} locked={locked} />
            </fieldset>
          </d.DialogV2Body>

          <d.DialogV2Footer className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {visibleCount} variable{visibleCount > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={hasEnvErrors || locked}>
                Save
                <SaveIcon className="ml-2 size-4" />
              </Button>
            </div>
          </d.DialogV2Footer>
        </d.DialogV2Content>
      </d.DialogV2>
    </>
  );
};

type EnvironmentVariablesListProps = {
  serviceIndex: number;
  /** While locked the list is view-only: the seed-an-empty-row effect is skipped so opening the dialog can't mutate the form. */
  locked?: boolean;
};

const EnvironmentVariablesList: FC<EnvironmentVariablesListProps> = ({ serviceIndex, locked = false }) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove, replace } = useFieldArray({ control, name: `services.${serviceIndex}.env`, keyName: "fieldId" });

  const visibleFields = fields.filter(f => !RESERVED_ENV_KEYS.has(f.key));

  useEffect(() => {
    if (visibleFields.length === 0 && !locked) {
      append({ id: nanoid(), key: "", value: "", isSecret: false }, { shouldFocus: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(() => {
    append({ id: nanoid(), key: "", value: "", isSecret: false });
  }, [append]);

  /**
   * Merges pasted `KEY=value` lines into the variables read live from the form: new keys are appended,
   * existing keys (including ones just typed or added) are updated in place, and the empty row pasted
   * into is dropped. Reading the live values is what makes a later paste append rather than overwrite.
   */
  const insertPastedEnvVars = useCallback(
    (event: ClipboardEvent<HTMLInputElement>, focusedEnvIndex: number) => {
      const pastedText = event.clipboardData.getData("text")?.trim();
      if (!pastedText || !pastedText.includes("=")) return;

      event.preventDefault();

      const nextEnv = [...(getValues(`services.${serviceIndex}.env`) ?? [])];
      let didUpdate = false;
      pastedText.split("\n").forEach(line => {
        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) return;

        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim();
        if (!key || RESERVED_ENV_KEYS.has(key)) return;
        didUpdate = true;

        const existingEnvIndex = nextEnv.findIndex(env => env.key === key);
        if (existingEnvIndex === -1) {
          nextEnv.push({ id: nanoid(), key, value, isSecret: false });
        } else {
          nextEnv[existingEnvIndex] = { ...nextEnv[existingEnvIndex], value };
        }
      });

      if (!didUpdate) return;
      if (!nextEnv[focusedEnvIndex]?.key.trim()) {
        nextEnv.splice(focusedEnvIndex, 1);
      }
      replace(nextEnv);
    },
    [getValues, replace, serviceIndex]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {visibleFields.map((field, visibleIndex) => (
          <EnvironmentVariableFields
            key={field.fieldId}
            serviceIndex={serviceIndex}
            envIndex={fields.indexOf(field)}
            visibleIndex={visibleIndex}
            onPasteKey={insertPastedEnvVars}
            onRemove={() => {
              const arrayIndex = fields.indexOf(field);
              remove(arrayIndex);
              if (visibleFields.length === 1) {
                append({ id: nanoid(), key: "", value: "", isSecret: false }, { shouldFocus: false });
              }
            }}
          />
        ))}
      </div>

      <div>
        <Button size="sm" type="button" variant="ghost" onClick={add} className="text-muted-foreground hover:text-foreground">
          <PlusIcon className="mr-1 h-4 w-4" />
          Add variable
        </Button>
      </div>
    </div>
  );
};

type EnvironmentVariableFieldsProps = {
  serviceIndex: number;
  envIndex: number;
  visibleIndex: number;
  onRemove: () => void;
  /** Parses pasted `KEY=value` lines into rows; `envIndex` is the row pasted into so an empty one can be dropped. */
  onPasteKey: (event: ClipboardEvent<HTMLInputElement>, envIndex: number) => void;
};

const EnvironmentVariableFields: FC<EnvironmentVariableFieldsProps> = ({ serviceIndex, envIndex, visibleIndex, onRemove, onPasteKey }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.env.${envIndex}` as const;

  const key = useController({ control, name: `${basePath}.key` });
  const value = useController({ control, name: `${basePath}.value` });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <Input
          aria-label={`Environment variable ${visibleIndex + 1} key`}
          placeholder="KEY"
          value={key.field.value ?? ""}
          onChange={key.field.onChange}
          onPaste={event => onPasteKey(event, envIndex)}
          inputClassName="h-9"
          className="flex-1"
        />
        <Input
          aria-label={`Environment variable ${visibleIndex + 1} value`}
          placeholder="value"
          value={value.field.value ?? ""}
          onChange={value.field.onChange}
          inputClassName="h-9"
          className="flex-1"
        />
        <Button
          size="icon"
          type="button"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          aria-label={`Remove environment variable ${visibleIndex + 1}`}
          onClick={onRemove}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
      {key.fieldState.error && <p className="pl-1 text-xs text-destructive">{key.fieldState.error.message}</p>}
    </div>
  );
};
