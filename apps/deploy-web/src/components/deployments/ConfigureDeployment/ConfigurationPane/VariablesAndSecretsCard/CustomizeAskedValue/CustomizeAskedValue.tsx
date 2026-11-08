"use client";
import { type ChangeEvent, type FC, type KeyboardEvent, useId, useState } from "react";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { PlusIcon, XIcon } from "lucide-react";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import type { AskedValueCustomization } from "../../../templateMode/TemplateModeProvider/TemplateModeProvider";

const MAX_LABEL_LENGTH = 80;
const MAX_HELP_LENGTH = 500;

type AskedValueType = TemplateAskedValue["type"];

const PLAIN_TYPE_OPTIONS: Array<{ type: Exclude<AskedValueType, "secret">; title: string }> = [
  { type: "text", title: "Text" },
  { type: "number", title: "Number" },
  { type: "boolean", title: "Yes/No" },
  { type: "choice", title: "Choice" }
];

type Props = {
  askedValue: TemplateAskedValue;
  customized: AskedValueCustomization;
  onCustomize: (patch: AskedValueCustomization) => void;
  onDone: () => void;
};

export const CustomizeAskedValue: FC<Props> = ({ askedValue, customized, onCustomize, onDone }) => {
  const id = useId();
  const isSecret = askedValue.type === "secret";
  const selectedType: AskedValueType = isSecret ? "secret" : customized.type ?? askedValue.type;
  const label = customized.label ?? askedValue.label;
  const help = customized.help ?? askedValue.help ?? "";
  const defaultValue = isSecret ? undefined : askedValue.default;
  const choices = customized.choices ?? (askedValue.type === "choice" ? askedValue.choices : []);
  const limits = limitsOf(askedValue);

  const changeType = (type: string) => {
    if (type !== "choice") return onCustomize({ type: type as AskedValueType });
    onCustomize({ type: "choice", choices: choices.length > 0 ? choices : seedChoices(defaultValue) });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase text-muted-foreground">Customize</span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onDone}>
          Done
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_10rem] gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-label`}>Label</Label>
          <Input
            id={`${id}-label`}
            value={label}
            maxLength={MAX_LABEL_LENGTH}
            onChange={event => onCustomize({ label: event.target.value })}
            inputClassName="h-9"
          />
          <span className="text-right text-xs text-muted-foreground">
            {label.length}/{MAX_LABEL_LENGTH}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-type`}>Type</Label>
          <Select value={selectedType} onValueChange={changeType} disabled={isSecret}>
            <SelectTrigger id={`${id}-type`} aria-label="Type" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isSecret ? (
                <SelectItem value="secret">Secret</SelectItem>
              ) : (
                PLAIN_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.type} value={option.type}>
                    {option.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-help`}>
          Help text <span className="font-normal text-muted-foreground">Optional</span>
        </Label>
        <Input
          id={`${id}-help`}
          aria-label="Help text"
          value={help}
          maxLength={MAX_HELP_LENGTH}
          onChange={event => onCustomize({ help: event.target.value })}
          inputClassName="h-9"
        />
        <span className="text-right text-xs text-muted-foreground">
          {help.length}/{MAX_HELP_LENGTH}
        </span>
      </div>

      {selectedType === "choice" && <ChoicesField choices={choices} defaultValue={defaultValue} onChange={next => onCustomize({ choices: next })} />}

      {selectedType === "number" && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <NumberField label="Min" value={customized.min ?? limits.min} onChange={min => onCustomize({ min })} />
          <NumberField label="Max" value={customized.max ?? limits.max} onChange={max => onCustomize({ max })} />
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox
              aria-label="Whole number"
              checked={customized.integer ?? limits.integer ?? false}
              onCheckedChange={checked => onCustomize({ integer: checked === true })}
            />
            Whole number
          </label>
        </div>
      )}

      {selectedType === "text" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Min length" value={customized.minLength ?? limits.minLength} onChange={minLength => onCustomize({ minLength })} />
          <NumberField label="Max length" value={customized.maxLength ?? limits.maxLength} onChange={maxLength => onCustomize({ maxLength })} />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          aria-label="Required"
          checked={customized.required ?? askedValue.required}
          onCheckedChange={checked => onCustomize({ required: checked === true })}
        />
        Required
        <span className="text-xs text-muted-foreground">· Your value becomes the default.</span>
      </label>
    </div>
  );
};

function seedChoices(defaultValue: string | undefined): string[] {
  return defaultValue ? [defaultValue] : [];
}

function limitsOf(askedValue: TemplateAskedValue): Pick<AskedValueCustomization, "min" | "max" | "integer" | "minLength" | "maxLength"> {
  switch (askedValue.type) {
    case "number":
      return { min: askedValue.min, max: askedValue.max, integer: askedValue.integer };
    case "text":
      return { minLength: askedValue.minLength, maxLength: askedValue.maxLength };
    default:
      return {};
  }
}

type ChoicesFieldProps = {
  choices: string[];
  defaultValue: string | undefined;
  onChange: (choices: string[]) => void;
};

const ChoicesField: FC<ChoicesFieldProps> = ({ choices, defaultValue, onChange }) => {
  const [newChoice, setNewChoice] = useState("");

  const addChoice = () => {
    const choice = newChoice.trim();
    if (choice === "") return;
    if (!choices.includes(choice)) onChange([...choices, choice]);
    setNewChoice("");
  };

  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addChoice();
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">Choices</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {choices.map(choice => (
          <span key={choice} className="flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-mono text-xs">
            <span>{choice}</span>
            {choice === defaultValue && <span className="font-sans text-muted-foreground">default</span>}
            <button
              type="button"
              aria-label={`Remove choice ${choice}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(choices.filter(other => other !== choice))}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          aria-label="New choice"
          placeholder="New choice"
          value={newChoice}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setNewChoice(event.target.value)}
          onKeyDown={addOnEnter}
          inputClassName="h-7 text-xs"
          className="w-32"
        />
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={addChoice}>
          <PlusIcon className="mr-1 h-3 w-3" aria-hidden="true" />
          Add choice
        </Button>
      </div>
    </div>
  );
};

type NumberFieldProps = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
};

const NumberField: FC<NumberFieldProps> = ({ label, value, onChange }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value ?? ""} onChange={event => onChange(parseOptionalNumber(event.target.value))} inputClassName="h-9" />
    </div>
  );
};

function parseOptionalNumber(text: string): number | undefined {
  const parsed = Number(text);
  return text === "" || Number.isNaN(parsed) ? undefined : parsed;
}
