"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button, Input, Switch } from "@akashnetwork/ui/components";
import { format } from "date-fns";
import { CircleAlertIcon, EyeIcon, EyeOffIcon, LockIcon, RotateCcwIcon } from "lucide-react";

import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { MarketplaceTemplate, TemplateAskedValue, TemplateVersionDetail } from "@src/types/marketplace-template";
import type { Answer } from "../askedValueAnswers";
import { answerFields, answerOf, askedValueIssuesOf, boundRowsOf, isAnswerRequired } from "../askedValueAnswers";

export const DEPENDENCIES = { TemplateIcon };

const SECRET_NOTE = "Sealed when you deploy. You won't be able to see it again.";

const ABSENT_NOTE = "Not in this configuration anymore";

const SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-popover px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive aria-[invalid=true]:ring-offset-1";

type Props = {
  askedValues: TemplateAskedValue[];
  template: MarketplaceTemplate;
  version: TemplateVersionDetail;
  disabled?: boolean;
  /** Each refused attempt to request bids reveals every field's error and moves the focus to the first field that has one. */
  blockedAttempts?: number;
  dependencies?: typeof DEPENDENCIES;
};

/** A view over the env rows each variable binds to, so the SDL preview shows the answers and a secret is sealed like any other. */
export const TemplateVariablesCard: FC<Props> = ({ askedValues, template, version, disabled = false, blockedAttempts = 0, dependencies: d = DEPENDENCIES }) => {
  const titleId = useId();
  const fieldIdPrefix = useId();
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  const issues = useMemo(() => askedValueIssuesOf({ services }, askedValues), [services, askedValues]);
  const [touchedKeys, setTouchedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const fieldIdOf = (key: string) => `${fieldIdPrefix}-${key}`;
  const isCurrent = template.currentVersion?.version === version.version;

  useEffect(
    function focusFirstFieldWithIssue() {
      if (blockedAttempts === 0) return;
      const issuesNow = askedValueIssuesOf(getValues(), askedValues);
      const first = askedValues.find(askedValue => issuesNow[askedValue.key]);
      if (first) document.getElementById(`${fieldIdPrefix}-${first.key}`)?.focus();
    },
    [blockedAttempts, askedValues, fieldIdPrefix, getValues]
  );

  function writeAnswer(askedValue: TemplateAskedValue, answer: string) {
    const { value, isSecret } = answerFields(askedValue, answer);
    boundRowsOf(getValues(), askedValue).forEach(({ serviceIndex, envIndex }) => {
      setValue(`services.${serviceIndex}.env.${envIndex}.value`, value);
      if (isSecret) setValue(`services.${serviceIndex}.env.${envIndex}.isSecret`, true);
    });
  }

  function touch(key: string) {
    setTouchedKeys(previous => (previous.has(key) ? previous : new Set(previous).add(key)));
  }

  function resetToDefaults() {
    askedValues.forEach(askedValue => writeAnswer(askedValue, defaultOf(askedValue)));
    setTouchedKeys(new Set());
  }

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
          <d.TemplateIcon icon={template.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-base font-semibold">
            {template.title}
          </h2>
          <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
            <span className="font-mono">
              {isCurrent ? `v${version.version} Current · ${format(new Date(version.createdAt), "MMM d, yyyy")}` : `v${version.version}`}
            </span>
            {!template.isOfficial && <span>Not reviewed by Akash</span>}
          </p>
        </div>
      </div>
      {askedValues.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
            <div>
              <h3 className="text-base font-semibold">Variables</h3>
              <p className="text-sm text-muted-foreground">These values go into the SDL below. Required fields are marked with *.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={resetToDefaults} className="gap-1.5">
              <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
              Reset to defaults
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-4 gap-y-5 p-4">
            {askedValues.map(askedValue => (
              <VariableField
                key={askedValue.key}
                id={fieldIdOf(askedValue.key)}
                askedValue={askedValue}
                answer={answerOf({ services }, askedValue)}
                issue={touchedKeys.has(askedValue.key) || blockedAttempts > 0 ? issues[askedValue.key] : undefined}
                disabled={disabled}
                onChange={answer => writeAnswer(askedValue, answer)}
                onTouch={() => touch(askedValue.key)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

function defaultOf(askedValue: TemplateAskedValue): string {
  return askedValue.type === "secret" ? "" : askedValue.default ?? "";
}

type VariableFieldProps = {
  id: string;
  askedValue: TemplateAskedValue;
  answer: Answer;
  issue: string | undefined;
  disabled: boolean;
  onChange: (answer: string) => void;
  onTouch: () => void;
};

function VariableField({ id, askedValue, answer, issue, disabled, onChange, onTouch }: VariableFieldProps) {
  const isRequired = isAnswerRequired(askedValue);
  const isAbsent = !answer.isPresent;
  const keyId = `${id}-key`;
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const note = isAbsent ? ABSENT_NOTE : askedValue.type === "secret" ? SECRET_NOTE : askedValue.help;
  const control: FieldControlProps = {
    id,
    value: answer.value,
    isInvalid: !!issue,
    isRequired,
    disabled: disabled || isAbsent,
    describedBy: [keyId, note && noteId, issue && errorId].filter(Boolean).join(" "),
    onChange,
    onTouch
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <label htmlFor={id} className="truncate text-sm font-medium">
            {askedValue.label}
          </label>
          {isRequired ? (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Optional</span>
          )}
        </div>
        <code id={keyId} className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {askedValue.key}
        </code>
      </div>
      <FieldControl askedValue={askedValue} label={askedValue.label} {...control} />
      {note && (
        <p id={noteId} className="flex items-center gap-1 text-xs text-muted-foreground">
          {askedValue.type === "secret" && !isAbsent && <LockIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
          {note}
        </p>
      )}
      {issue && (
        <p id={errorId} className="flex items-center gap-1 text-xs text-destructive">
          <CircleAlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {issue}
        </p>
      )}
    </div>
  );
}

type FieldControlProps = {
  id: string;
  value: string;
  isInvalid: boolean;
  isRequired: boolean;
  disabled: boolean;
  describedBy: string;
  onChange: (answer: string) => void;
  onTouch: () => void;
};

type SharedControlProps = {
  id: string;
  disabled: boolean;
  "aria-required": boolean;
  "aria-invalid": boolean;
  "aria-describedby": string;
  onBlur: () => void;
};

function FieldControl({ askedValue, label, ...control }: FieldControlProps & { askedValue: TemplateAskedValue; label: string }): ReactNode {
  const { id, value, isInvalid, isRequired, disabled, describedBy, onChange, onTouch } = control;
  const shared: SharedControlProps = {
    id,
    disabled,
    "aria-required": isRequired,
    "aria-invalid": isInvalid,
    "aria-describedby": describedBy,
    onBlur: onTouch
  };

  switch (askedValue.type) {
    case "boolean":
      return (
        <div className="flex h-10 items-center gap-3">
          <Switch
            id={id}
            disabled={disabled}
            aria-invalid={isInvalid}
            aria-describedby={describedBy}
            checked={value === "true"}
            onCheckedChange={checked => onChange(String(checked))}
          />
          <span className="text-sm text-muted-foreground">{value === "true" ? "On" : "Off"}</span>
        </div>
      );
    case "choice":
      return (
        <select {...shared} value={value} onChange={event => onChange(event.target.value)} className={SELECT_CLASSES}>
          {!askedValue.choices.includes(value) && (
            <option value={value} disabled>
              {value === "" ? "Choose…" : value}
            </option>
          )}
          {askedValue.choices.map(choice => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <Input
          {...shared}
          type="number"
          inputMode="decimal"
          min={askedValue.min}
          max={askedValue.max}
          step={askedValue.integer ? 1 : "any"}
          value={value}
          error={isInvalid}
          onChange={event => onChange(event.target.value)}
        />
      );
    case "secret":
      return <SecretInput shared={shared} label={label} value={value} isInvalid={isInvalid} onChange={onChange} />;
    default:
      return <Input {...shared} type="text" value={value} error={isInvalid} onChange={event => onChange(event.target.value)} />;
  }
}

type SecretInputProps = {
  shared: SharedControlProps;
  label: string;
  value: string;
  isInvalid: boolean;
  onChange: (answer: string) => void;
};

function SecretInput({ shared, label, value, isInvalid, onChange }: SecretInputProps) {
  const [isShown, setIsShown] = useState(false);

  return (
    <Input
      {...shared}
      type={isShown ? "text" : "password"}
      autoComplete="new-password"
      spellCheck={false}
      value={value}
      error={isInvalid}
      onChange={event => onChange(event.target.value)}
      endIcon={
        <button
          type="button"
          aria-label={`${isShown ? "Hide" : "Show"} ${label}`}
          onClick={() => setIsShown(previous => !previous)}
          className="flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
        >
          {isShown ? <EyeOffIcon className="h-4 w-4" aria-hidden="true" /> : <EyeIcon className="h-4 w-4" aria-hidden="true" />}
        </button>
      }
    />
  );
}
