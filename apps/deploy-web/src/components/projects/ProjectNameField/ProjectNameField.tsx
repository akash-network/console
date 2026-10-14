"use client";
import { useId } from "react";
import { Input, Label } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { MAX_PROJECT_SLUG_LENGTH } from "@src/types/project";
import { slugify } from "@src/utils/slugify";

export function toProjectSlug(name: string): string {
  return slugify(name, MAX_PROJECT_SLUG_LENGTH);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Slugs the organization already uses, which the field refuses with a reason. */
  takenSlugs: string[];
  autoFocus?: boolean;
  /** What happens to the name, for the hint that shows the slug it turns into. */
  verb?: "created" | "renamed";
}

/** The project name input with the hint that tells how the name turns into a slug, and when that slug is taken. */
export function ProjectNameField({ value, onChange, takenSlugs, autoFocus, verb = "created" }: Props) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const slug = toProjectSlug(value);
  const isTaken = !!slug && takenSlugs.includes(slug);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-[13px]">
        Project name
      </Label>
      <Input
        id={inputId}
        type="text"
        value={value}
        placeholder="checkout-api"
        autoFocus={autoFocus}
        autoComplete="off"
        aria-describedby={hintId}
        aria-invalid={isTaken || undefined}
        error={isTaken}
        onChange={event => onChange(event.target.value)}
      />
      <p id={hintId} className={cn("text-xs leading-[17px] text-muted-foreground", { "text-destructive": isTaken })}>
        {isTaken ? (
          `A project named ${slug} already exists.`
        ) : slug && slug !== value ? (
          <>
            Will be {verb} as <span className="font-mono">{slug}</span>
          </>
        ) : (
          "Lowercase letters, numbers and hyphens."
        )}
      </p>
    </div>
  );
}
