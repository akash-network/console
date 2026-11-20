import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { BadgeCheck } from "lucide-react";

export const VERIFIED_PUBLISHER_LABEL = "Verified by Akash";

export const PublisherName: FC<{ name: string; verified: boolean; className?: string }> = ({ name, verified, className }) => (
  <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
    <PublisherInitials name={name} className="h-5 w-5 rounded-[5px] text-[9.5px]" />
    <span className="truncate font-medium text-foreground">{name}</span>
    {verified && <VerifiedPublisherMark className="h-3.5 w-3.5" />}
  </span>
);

export const PublisherInitials: FC<{ name: string; className?: string }> = ({ name, className }) => (
  <span
    aria-hidden="true"
    className={cn("flex shrink-0 items-center justify-center bg-foreground/10 font-mono font-semibold uppercase leading-none", className)}
  >
    {initialsOf(name)}
  </span>
);

export const VerifiedPublisherMark: FC<{ className?: string }> = ({ className }) => (
  <span role="img" aria-label={VERIFIED_PUBLISHER_LABEL} title={VERIFIED_PUBLISHER_LABEL} className="inline-flex shrink-0 text-blue-600 dark:text-blue-400">
    <BadgeCheck className={className} aria-hidden="true" />
  </span>
);

function initialsOf(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 2)
    .map(word => [...word][0])
    .join("");
}
