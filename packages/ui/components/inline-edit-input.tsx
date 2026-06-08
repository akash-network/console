"use client";
import type { FC, KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";

import { cn } from "../utils";

type Props = {
  name: string;
  label: string;
  className?: string;
};

/**
 * Inline-editable text field bound to a react-hook-form field by `name`. Shows
 * the committed value as plain text-like input; edits commit on blur/Enter,
 * Escape reverts to the committed value, and the field's validation error (if
 * any) renders beneath it. Must be rendered within a FormProvider.
 */
export const InlineEditInput: FC<Props> = ({ name, label, className }) => {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <EditableText label={label} value={field.value} onCommit={field.onChange} error={fieldState.error?.message} className={className} />
      )}
    />
  );
};

interface EditableTextProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  error?: string;
  className?: string;
}

function EditableText({ label, value, onCommit, error, className }: EditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isCancelling = useRef(false);
  const errorId = useId();

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
        aria-describedby={error ? errorId : undefined}
        value={draft ?? value}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="text-foreground focus:ring-ring block h-5 w-full truncate border-none bg-transparent p-0 font-mono text-sm leading-5 outline-none focus:rounded focus:ring-1"
      />
      {error && (
        <p id={errorId} className="text-destructive mt-0.5 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
