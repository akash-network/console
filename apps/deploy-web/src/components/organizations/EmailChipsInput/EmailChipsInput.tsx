"use client";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { X } from "lucide-react";

const EMAIL_SEPARATORS = /[\s,;]+/;

export function parseEmailList(text: string): string[] {
  return text
    .split(EMAIL_SEPARATORS)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
}

type Props = {
  id?: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  /** The problem with an address, or null when it can be invited. */
  getError?: (email: string) => string | null;
  placeholder?: string;
  autoFocus?: boolean;
  "aria-describedby"?: string;
};

export function EmailChipsInput({ id, emails, onChange, getError = () => null, placeholder = "name@company.com", autoFocus, ...describedBy }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (text: string) => {
    const next = [...emails];
    for (const email of parseEmailList(text)) {
      if (!next.includes(email)) next.push(email);
    }
    if (next.length !== emails.length) onChange(next);
    setDraft("");
  };

  const remove = (email: string) => onChange(emails.filter(candidate => candidate !== email));

  const typeDraft = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (EMAIL_SEPARATORS.test(value)) {
      commit(value);
    } else {
      setDraft(value);
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && draft.trim()) {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && emails.length) {
      onChange(emails.slice(0, -1));
    }
  };

  const pasteAddresses = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    commit(`${draft} ${event.clipboardData.getData("text")}`);
  };

  return (
    <div
      className="flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-popover px-2 py-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      onClick={() => inputRef.current?.focus()}
    >
      {emails.map(email => {
        const error = getError(email);
        return (
          <span
            key={email}
            title={error ?? undefined}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted pl-2 pr-0.5 font-mono text-xs text-foreground",
              error && "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            {email}
            <button
              type="button"
              aria-label={`Remove ${email}`}
              className="inline-flex h-[18px] w-[18px] items-center justify-center rounded hover:bg-foreground/10"
              onClick={event => {
                event.stopPropagation();
                remove(email);
              }}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        value={draft}
        autoFocus={autoFocus}
        placeholder={emails.length ? "" : placeholder}
        className="h-6 min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onChange={typeDraft}
        onKeyDown={handleKey}
        onPaste={pasteAddresses}
        onBlur={() => draft.trim() && commit(draft)}
        {...describedBy}
      />
    </div>
  );
}
