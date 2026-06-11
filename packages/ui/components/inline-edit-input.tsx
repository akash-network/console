"use client";
import type { FC, KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";

import { cn } from "../utils";
import { FieldErrorMessage } from "./field-error-message";

type Props = {
  name: string;
  label: string;
  className?: string;
  /**
   * When set, this component does not render the field's error message itself.
   * The input still turns destructive on error and links to `errorMessageId`
   * via aria-describedby, leaving the consumer to render the message where it
   * wants (e.g. full-width below a card).
   */
  suppressErrorMessage?: boolean;
  /** Id of the externally rendered error message; only used when `suppressErrorMessage` is set. */
  errorMessageId?: string;
};

/**
 * Inline-editable text field bound to a react-hook-form field by `name`. Shows
 * the committed value as plain text-like input; edits commit on blur/Enter and
 * Escape reverts to the committed value. On validation error the input text
 * turns destructive and, by default, the message renders beneath the input. Set
 * `suppressErrorMessage` to render the message elsewhere. Must be rendered
 * within a FormProvider.
 */
export const InlineEditInput: FC<Props> = ({ name, label, className, suppressErrorMessage, errorMessageId }) => {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <EditableText
          label={label}
          value={field.value}
          onCommit={field.onChange}
          error={fieldState.error?.message}
          suppressErrorMessage={suppressErrorMessage}
          errorMessageId={errorMessageId}
          className={className}
        />
      )}
    />
  );
};

interface EditableTextProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  error?: string;
  suppressErrorMessage?: boolean;
  errorMessageId?: string;
  className?: string;
}

function EditableText({ label, value, onCommit, error, suppressErrorMessage, errorMessageId, className }: EditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isCancelling = useRef(false);
  const internalErrorId = useId();
  const hasError = !!error;
  const rendersOwnMessage = hasError && !suppressErrorMessage;
  const describedById = hasError ? (suppressErrorMessage ? errorMessageId : internalErrorId) : undefined;

  function commitDraft() {
    if (draft !== null && draft !== value) {
      onCommit(draft);
    }
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      isCancelling.current = true;
      setDraft(null);
      event.currentTarget.blur();
    }
  }

  function handleBlur() {
    if (isCancelling.current) {
      isCancelling.current = false;
      return;
    }
    commitDraft();
  }

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <input
        type="text"
        aria-label={label}
        aria-invalid={hasError || undefined}
        aria-describedby={describedById}
        value={draft ?? value}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "focus:ring-ring block h-5 w-full truncate border-none bg-transparent p-0 font-mono text-sm leading-5 outline-none focus:rounded focus:ring-1",
          hasError ? "text-destructive" : "text-foreground"
        )}
      />
      {rendersOwnMessage && <FieldErrorMessage id={internalErrorId}>{error}</FieldErrorMessage>}
    </div>
  );
}
