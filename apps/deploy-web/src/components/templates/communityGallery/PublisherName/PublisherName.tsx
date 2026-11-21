import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { BadgeCheck } from "lucide-react";

export const VERIFIED_PUBLISHER_LABEL = "Verified by Akash";

export const PublisherName: FC<{ name: string; verified: boolean; className?: string }> = ({ name, verified, className }) => (
  <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-foreground/10 font-mono text-[9.5px] font-semibold uppercase leading-none"
    >
      {initialsOf(name)}
    </span>
    <span className="truncate font-medium text-foreground">{name}</span>
    {verified && (
      <span role="img" aria-label={VERIFIED_PUBLISHER_LABEL} title={VERIFIED_PUBLISHER_LABEL} className="inline-flex shrink-0 text-blue-600 dark:text-blue-400">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    )}
  </span>
);

function initialsOf(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 2)
    .map(word => [...word][0])
    .join("");
}
