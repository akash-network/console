"use client";
import { type ClipboardEvent, type FC, useCallback, useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Badge,
  Button,
  CollapsibleCard,
  CustomNoDivTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  TooltipProvider
} from "@akashnetwork/ui/components";
import { ChevronDownIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";

import type { SdlBuilderFormValuesType } from "@src/types";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";
import { isSdlReference, secretNameOf } from "@src/utils/sdl/sdlSecrets";
import { useInheritedSecrets } from "../../InheritedSecretsProvider/InheritedSecretsProvider";

export const DEPENDENCIES = {
  CollapsibleCard,
  CustomNoDivTooltip,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  useInheritedSecrets
};

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);

type VariableKind = "variable" | "secret";

const ADD_OPTIONS: Array<{ kind: VariableKind; title: string; description: string; Icon: typeof KeyRoundIcon }> = [
  { kind: "variable", title: "Environment Variable", description: "Plain key/value, visible in the SDL", Icon: KeyRoundIcon },
  { kind: "secret", title: "Secret", description: "Value stays masked, encrypted at rest", Icon: LockIcon }
];

const EMPTY_STATE = "Nothing set yet. Add a variable for a plain key/value pair, or a secret for a value that should stay masked.";

type Props = {
  serviceIndex: number;
  /** While locked the rows still show but every input, toggle and the Add menu are disabled; the card shows the lock glyph and dims. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** A secret row's value never reaches the SDL, which carries a reference in its place, and reserved keys are managed elsewhere. */
export const VariablesAndSecretsCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove, replace } = useFieldArray({ control, name: `services.${serviceIndex}.env`, keyName: "fieldId" });
  const env = useWatch({ control, name: `services.${serviceIndex}.env` }) ?? [];
  const visibleFields = fields.filter(field => !RESERVED_ENV_KEYS.has(field.key));
  const visibleCount = env.filter(variable => !RESERVED_ENV_KEYS.has(variable.key)).length;
  const secretCount = env.filter(variable => variable.isSecret && !RESERVED_ENV_KEYS.has(variable.key)).length;

  const add = useCallback(
    (kind: VariableKind) => {
      append({ id: nanoid(), key: "", value: "", isSecret: kind === "secret" });
    },
    [append]
  );

  /** A pasted key that already exists is updated in place, keeping whichever side marked it secret so a paste can never unmask one. */
  const insertPastedEnvVars = useCallback(
    (event: ClipboardEvent<HTMLInputElement>, focusedEnvIndex: number) => {
      const pastedText = event.clipboardData.getData("text")?.trim();
      if (!pastedText || !pastedText.includes("=")) return;

      event.preventDefault();

      const nextEnv = [...(getValues(`services.${serviceIndex}.env`) ?? [])];
      const isSecret = !!nextEnv[focusedEnvIndex]?.isSecret;
      let didUpdate = false;
      pastedText.split("\n").forEach(line => {
        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) return;

        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim();
        if (!key || RESERVED_ENV_KEYS.has(key)) return;
        didUpdate = true;

        const existingEnvIndex = nextEnv.findIndex(variable => variable.key === key);
        if (existingEnvIndex === -1) {
          nextEnv.push({ id: nanoid(), key, value, isSecret });
        } else {
          const existing = nextEnv[existingEnvIndex];
          nextEnv[existingEnvIndex] = { ...existing, value: pastedValueOver(existing.value, value), isSecret: existing.isSecret || isSecret };
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
    <d.CollapsibleCard
      locked={locked}
      title="Env Vars & Secrets"
      icon={<KeyRoundIcon className="h-4 w-4" />}
      headerControl={visibleCount > 0 ? <Badge variant="secondary">{visibleCount}</Badge> : undefined}
    >
      <fieldset disabled={locked} className="flex flex-col gap-3 border-0 p-0">
        {visibleFields.length === 0 && <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>}

        {visibleFields.length > 0 && (
          <TooltipProvider>
            <div className="flex flex-col gap-2">
              {visibleFields.map((field, visibleIndex) => (
                <VariableRow
                  key={field.fieldId}
                  serviceIndex={serviceIndex}
                  envIndex={fields.indexOf(field)}
                  visibleIndex={visibleIndex}
                  onPasteKey={insertPastedEnvVars}
                  onRemove={() => remove(fields.indexOf(field))}
                  dependencies={d}
                />
              ))}
            </div>
          </TooltipProvider>
        )}

        <d.DropdownMenu modal={false}>
          <d.DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="h-10 w-full border-dashed text-muted-foreground hover:text-foreground">
              <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Add
              <ChevronDownIcon className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </d.DropdownMenuTrigger>
          <d.DropdownMenuContent align="start" className="w-80">
            {ADD_OPTIONS.map(option => (
              <d.DropdownMenuItem key={option.kind} className="items-start gap-3 py-2" onSelect={() => add(option.kind)}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
                  <option.Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{option.title}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </d.DropdownMenuItem>
            ))}
          </d.DropdownMenuContent>
        </d.DropdownMenu>

        {secretCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="h-3 w-3" aria-hidden="true" />
            {secretCount} {secretCount === 1 ? "secret" : "secrets"} encrypted at rest
          </p>
        )}
      </fieldset>
    </d.CollapsibleCard>
  );
};

type VariableRowProps = {
  serviceIndex: number;
  envIndex: number;
  visibleIndex: number;
  onRemove: () => void;
  /** Parses pasted `KEY=value` lines into rows; `envIndex` is the row pasted into so an empty one can be dropped. */
  onPasteKey: (event: ClipboardEvent<HTMLInputElement>, envIndex: number) => void;
  dependencies: typeof DEPENDENCIES;
};

/** A dotenv template lists its keys with no values, so an empty pasted value leaves a kept reference standing rather than unsetting an already sealed secret. */
function pastedValueOver(existingValue: string | undefined, pasted: string): string {
  return !pasted && isSdlReference(existingValue ?? "") ? (existingValue as string) : pasted;
}

const VariableRow: FC<VariableRowProps> = ({ serviceIndex, envIndex, visibleIndex, onRemove, onPasteKey, dependencies: d }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.env.${envIndex}` as const;
  const key = useController({ control, name: `${basePath}.key` });
  const value = useController({ control, name: `${basePath}.value` });
  const isSecret = useController({ control, name: `${basePath}.isSecret` });
  const inheritedSecrets = d.useInheritedSecrets();
  const [isRevealed, setRevealed] = useState(false);
  const secret = !!isSecret.field.value;
  const isKept = secret && isSdlReference(value.field.value ?? "");
  const keptName = isKept ? secretNameOf(value.field.value ?? "") : null;
  const inheritedFrom = keptName !== null && inheritedSecrets?.names.has(keptName) ? inheritedSecrets.sourceDseq : null;
  const label = `Environment variable ${visibleIndex + 1}`;

  /** A kept reference has no value to show as plain text, so turning it into a variable starts from an empty value. */
  const toggleKind = useCallback(() => {
    if (isKept) value.field.onChange("");
    isSecret.field.onChange(!secret);
    setRevealed(false);
  }, [isKept, secret, value.field, isSecret.field]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <d.CustomNoDivTooltip
          title={
            secret
              ? "Secret · value stays masked and is encrypted at rest. Click to make it a plain variable."
              : "Variable · plain key/value exposed at runtime. Click to make it a secret."
          }
        >
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            aria-label={secret ? `Make ${label} a plain variable` : `Make ${label} a secret`}
            aria-pressed={secret}
            onClick={toggleKind}
          >
            {secret ? <LockIcon className="h-4 w-4" /> : <KeyRoundIcon className="h-4 w-4" />}
          </Button>
        </d.CustomNoDivTooltip>
        <Input
          aria-label={`${label} key`}
          placeholder="KEY"
          value={key.field.value ?? ""}
          onChange={key.field.onChange}
          onBlur={key.field.onBlur}
          onPaste={event => onPasteKey(event, envIndex)}
          error={!!key.fieldState.error}
          inputClassName="h-9"
          className="flex-1"
        />
        <Input
          aria-label={`${label} value`}
          type={secret && !isRevealed ? "password" : "text"}
          autoComplete="off"
          placeholder={secret ? keptPlaceholder(isKept, inheritedFrom) : "value"}
          value={isKept ? "" : value.field.value ?? ""}
          onChange={value.field.onChange}
          onBlur={value.field.onBlur}
          error={!!value.fieldState.error}
          inputClassName="h-9"
          className="flex-1"
        />
        {secret && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            aria-label={isRevealed ? `Hide ${label} value` : `Show ${label} value`}
            onClick={() => setRevealed(revealed => !revealed)}
          >
            {isRevealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        )}
        <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label={`Remove ${label}`} onClick={onRemove}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      {key.fieldState.error && <p className="pl-1 text-xs text-destructive">{key.fieldState.error.message}</p>}
      {value.fieldState.error && <p className="pl-1 text-xs text-destructive">{value.fieldState.error.message}</p>}
      {isKept && inheritedFrom === null && <p className="pl-1 text-xs text-muted-foreground">The value was not included. Enter it before requesting quotes.</p>}
    </div>
  );
};

function keptPlaceholder(isKept: boolean, inheritedFrom: string | null): string {
  if (!isKept) return "Secret value";
  if (inheritedFrom !== null) return `Kept from deployment #${inheritedFrom}. Type to replace.`;
  return "Kept from the SDL. Type to replace.";
}
